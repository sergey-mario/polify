import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AiStatus, GrammarRule, Word } from './types.js';

// gemini-2.5-flash has free-tier quota for new AI Studio projects (10 RPM, 250 RPD).
// gemini-2.0-flash often returns 429 with limit:0 on free tier despite being listed.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const BATCH_SIZE = 20;
// Pace batches at 7s to stay under 10 RPM (~8.5 effective RPM with request time).
const BATCH_DELAY_MS = Number(process.env.GEMINI_BATCH_DELAY_MS ?? 7000);
const MAX_RETRIES = 4;

interface EnrichInput {
  id: string;
  polish: string;
  synonym?: string;
  example?: string;
}

interface EnrichOutput {
  id: string;
  translationRu: string;
  synonym: string;
  example: string;
  aiStatus: AiStatus;
}

const ENRICH_SYSTEM = `You are helping someone learn Polish.

For each Polish word or expression, enrich the item with:
- a Russian translation (translationRu)
- a natural Polish synonym (synonym), if appropriate; otherwise empty string
- a simple, popular, conversational Polish example (example)

If the meaning is ambiguous, choose the most common conversational meaning, but do not invent a specialized or niche context.

Keep examples short, natural, and useful for language learning.

Set aiStatus per item:
- "complete" if everything is clear and you produced a confident translation, synonym (or you intentionally left it empty as not applicable), and example.
- "partial" if you could only enrich some of the requested fields confidently.
- "uncertain" if you are not confident about the meaning.

Preserve the input id verbatim in the output.

Return strict JSON only — an array of objects with this exact shape:
[
  { "id": string, "translationRu": string, "synonym": string, "example": string, "aiStatus": "complete" | "partial" | "uncertain" }
]
No prose, no markdown fences.`;

const GRAMMAR_SYSTEM = `You are a Polish language teacher.

You will receive 10 Polish words/expressions selected for today's practice.
Pick one short, useful grammar rule that connects to these words (e.g. a tense, case, verb pattern, or syntactic pattern that several of them illustrate).

Return strict JSON only with this exact shape:
{
  "title": string,        // grammar rule title in Polish
  "explanation": string,  // 1-3 sentence explanation in Polish, plain language
  "examples": string[]    // 2-4 short Polish example sentences using today's words where possible
}
No prose, no markdown fences.`;

export async function enrichWords(words: Word[], apiKey: string): Promise<Word[]> {
  if (words.length === 0) return words;
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: ENRICH_SYSTEM,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
  });

  const enriched = new Map<string, EnrichOutput>();
  const totalBatches = Math.ceil(words.length / BATCH_SIZE);
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batchNum = i / BATCH_SIZE + 1;
    const batch = words.slice(i, i + BATCH_SIZE);
    const input: EnrichInput[] = batch.map((w) => ({
      id: w.id,
      polish: w.polish,
      synonym: w.synonym,
      example: w.example,
    }));
    const result = await callWithRetry(
      () => model.generateContent(JSON.stringify(input)),
      `enrich batch ${batchNum}/${totalBatches}`,
    );
    if (result) {
      try {
        const parsed = parseEnrichResponse(result.response.text());
        for (const item of parsed) enriched.set(item.id, item);
        console.log(`[enrich] batch ${batchNum}/${totalBatches}: enriched ${parsed.length}/${batch.length}`);
      } catch (err) {
        console.warn(`[enrich] batch ${batchNum} parse failed:`, err);
      }
    }
    if (i + BATCH_SIZE < words.length) await sleep(BATCH_DELAY_MS);
  }

  return words.map((w) => mergeEnrichment(w, enriched.get(w.id)));
}

export async function generateGrammarRule(words: Word[], apiKey: string): Promise<GrammarRule> {
  const fallback: GrammarRule = {
    title: 'Powtórka słownictwa',
    explanation: 'Dziś koncentrujemy się na praktyce wybranych słów i wyrażeń w naturalnych zdaniach.',
    examples: [],
  };
  if (words.length === 0) return fallback;

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: GRAMMAR_SYSTEM,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
  });

  const input = words.map((w) => ({
    polish: w.polish,
    synonym: w.synonym,
    example: w.example,
    translationRu: w.translationRu,
  }));

  const result = await callWithRetry(
    () => model.generateContent(JSON.stringify(input)),
    'grammar rule',
  );
  if (!result) return fallback;
  try {
    const parsed = JSON.parse(result.response.text());
    if (
      typeof parsed?.title === 'string' &&
      typeof parsed?.explanation === 'string' &&
      Array.isArray(parsed?.examples)
    ) {
      return {
        title: parsed.title,
        explanation: parsed.explanation,
        examples: parsed.examples.filter((e: unknown): e is string => typeof e === 'string'),
      };
    }
    console.warn('[grammar] response did not match expected shape');
    return fallback;
  } catch (err) {
    console.warn('[grammar] parse failed:', err);
    return fallback;
  }
}

async function callWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        const delaySec = parseRetryDelaySec(err) ?? Math.min(60, 5 * 2 ** (attempt - 1));
        console.warn(`[${label}] 429, retrying in ${delaySec}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(delaySec * 1000);
        continue;
      }
      console.warn(`[${label}] failed:`, errorSummary(err));
      return null;
    }
  }
  return null;
}

function parseRetryDelaySec(err: unknown): number | null {
  const details = (err as { errorDetails?: Array<{ '@type'?: string; retryDelay?: string }> })
    ?.errorDetails;
  if (!Array.isArray(details)) return null;
  for (const d of details) {
    if (typeof d?.retryDelay === 'string') {
      const m = d.retryDelay.match(/^(\d+)(?:\.\d+)?s$/);
      if (m) return Number(m[1]) + 1; // small buffer
    }
  }
  return null;
}

function errorSummary(err: unknown): string {
  if (err instanceof Error) {
    const status = (err as { status?: number }).status;
    return status ? `[${status}] ${err.message.split('\n')[0]}` : err.message.split('\n')[0];
  }
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEnrichResponse(text: string): EnrichOutput[] {
  // Gemini with responseMimeType=application/json returns clean JSON, but be defensive.
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const data = JSON.parse(cleaned);
  if (!Array.isArray(data)) throw new Error('Expected JSON array from enrichment');
  return data
    .filter((d): d is EnrichOutput =>
      typeof d?.id === 'string' &&
      typeof d?.translationRu === 'string' &&
      typeof d?.synonym === 'string' &&
      typeof d?.example === 'string' &&
      (d?.aiStatus === 'complete' || d?.aiStatus === 'partial' || d?.aiStatus === 'uncertain'),
    );
}

function mergeEnrichment(word: Word, ai?: EnrichOutput): Word {
  if (!ai) {
    return { ...word, aiStatus: word.aiStatus === 'complete' ? 'partial' : word.aiStatus };
  }
  // Prefer human-provided synonym/example from the sheet over AI-generated ones.
  return {
    ...word,
    synonym: word.synonym || ai.synonym || undefined,
    example: word.example || ai.example || undefined,
    translationRu: ai.translationRu || undefined,
    aiStatus: ai.aiStatus,
  };
}
