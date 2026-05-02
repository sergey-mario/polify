import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AiStatus, Content, Word } from './types.js';
import { fetchSheetCsv, normalizeRows, parseCsv, rowsToWords } from './fetch-sheet.js';
import { enrichWords, generateGrammarRule } from './enrich-with-ai.js';
import { pickDailyWords } from './generate-daily-practice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'public/data/content.json');
const MANUAL_SEED = resolve(ROOT, 'data/manual-enrichments.json');

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkchKrWgHRG4t_oXpHAcUhIrjtxSmEjWOycdzUXdLdNgukuhm-2XciZHcUaLDV0UGHhcibWgjQpJA_/pub?output=csv';

interface Enrichment {
  translationRu?: string;
  synonym?: string;
  example?: string;
  aiStatus: AiStatus;
}

async function main(): Promise<void> {
  const sheetUrl = process.env.GOOGLE_SHEETS_CSV_URL ?? DEFAULT_SHEET_URL;
  const apiKey = process.env.GEMINI_API_KEY;
  const skipAi = !apiKey || process.env.SKIP_AI === '1';

  console.log(`[update] fetching sheet: ${redactUrl(sheetUrl)}`);
  const csv = await fetchSheetCsv(sheetUrl);
  const rows = normalizeRows(parseCsv(csv));
  const baseWords = rowsToWords(rows);
  console.log(`[update] parsed ${baseWords.length} rows from sheet`);

  // Cache priority: previous content.json (per-word ID) > manual-seed (per polish text).
  const previous = await readPrevious();
  const cacheById = buildCacheById(previous);
  const cacheByPolish = buildCacheByPolish(previous);
  const manualByPolish = await readManualSeed();
  console.log(
    `[update] cache: ${cacheById.size} entries from previous content.json, ` +
      `${manualByPolish.size} entries from manual seed`,
  );

  // Apply cache: each base word inherits the most recent enrichment we have for it.
  const merged = baseWords.map((w) =>
    applyEnrichment(
      w,
      cacheById.get(w.id) ?? cacheByPolish.get(w.polish) ?? manualByPolish.get(w.polish),
    ),
  );

  // Daily set: prefer fully-valid (translation + synonym/example, status != uncertain).
  const yesterdayIds = new Set(previous?.dailyPractice?.words?.map((w) => w.id) ?? []);
  let dailySelection = pickDailyWords(merged, yesterdayIds, 10);

  // Fallback: if too few enriched words yet, allow words missing translation
  // and we'll enrich them via Gemini below.
  if (dailySelection.length < 10) {
    const need = 10 - dailySelection.length;
    const taken = new Set(dailySelection.map((w) => w.id));
    const candidates = merged.filter(
      (w) =>
        !taken.has(w.id) &&
        !yesterdayIds.has(w.id) &&
        (w.synonym || w.example) &&
        w.aiStatus !== 'uncertain',
    );
    const filler = shuffle(candidates).slice(0, need);
    dailySelection = [...dailySelection, ...filler];
    console.log(`[update] daily filler: added ${filler.length} un-enriched words to reach ${dailySelection.length}/10`);
  }

  // Enrich on demand: only daily words missing translationRu (small batch, cheap).
  const needsEnrichment = dailySelection.filter((w) => !w.translationRu);
  let enrichedDaily = dailySelection;
  if (needsEnrichment.length > 0) {
    if (skipAi) {
      console.log(
        `[update] SKIP_AI active — ${needsEnrichment.length} daily words remain un-enriched`,
      );
    } else {
      console.log(`[update] enriching ${needsEnrichment.length} daily words via Gemini`);
      const enriched = await enrichWords(needsEnrichment, apiKey!);
      const enrichedById = new Map(enriched.map((w) => [w.id, w]));
      enrichedDaily = dailySelection.map((w) => enrichedById.get(w.id) ?? w);
    }
  } else {
    console.log('[update] daily set fully cached — no enrichment API calls needed');
  }

  // Reflect enriched daily set into the all-words list so future runs cache it.
  const enrichedById = new Map(enrichedDaily.map((w) => [w.id, w]));
  const allWords = merged.map((w) => enrichedById.get(w.id) ?? w);

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const validDaily = enrichedDaily.filter((w) => w.translationRu && w.aiStatus !== 'uncertain');
  const grammarRule =
    skipAi || validDaily.length === 0
      ? fallbackGrammar(skipAi)
      : await generateGrammarRule(validDaily, apiKey!);

  const content: Content = {
    generatedAt: today.toISOString(),
    dailyPractice: {
      date: isoDate,
      words: enrichedDaily,
      grammarRule,
    },
    allWords,
    metadata: {
      source: 'google-sheets-csv',
      totalWords: allWords.length,
      validWords: allWords.filter((w) => w.aiStatus === 'complete').length,
      partialWords: allWords.filter((w) => w.aiStatus === 'partial').length,
      uncertainWords: allWords.filter((w) => w.aiStatus === 'uncertain').length,
    },
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(
    `[update] wrote ${OUTPUT} — ${content.metadata.validWords} complete, ` +
      `${content.metadata.partialWords} partial, ${content.metadata.uncertainWords} uncertain`,
  );
}

function applyEnrichment(word: Word, e: Enrichment | undefined): Word {
  if (!e) return word;
  return {
    ...word,
    translationRu: e.translationRu ?? word.translationRu,
    synonym: word.synonym || e.synonym,
    example: word.example || e.example,
    aiStatus: e.aiStatus,
  };
}

function buildCacheById(prev: Content | null): Map<string, Enrichment> {
  if (!prev?.allWords) return new Map();
  const map = new Map<string, Enrichment>();
  for (const w of prev.allWords) {
    if (w.translationRu || w.aiStatus === 'uncertain') {
      map.set(w.id, {
        translationRu: w.translationRu,
        synonym: w.synonym,
        example: w.example,
        aiStatus: w.aiStatus,
      });
    }
  }
  return map;
}

function buildCacheByPolish(prev: Content | null): Map<string, Enrichment> {
  if (!prev?.allWords) return new Map();
  const map = new Map<string, Enrichment>();
  for (const w of prev.allWords) {
    if (!w.translationRu) continue;
    if (!map.has(w.polish)) {
      map.set(w.polish, {
        translationRu: w.translationRu,
        synonym: w.synonym,
        example: w.example,
        aiStatus: w.aiStatus,
      });
    }
  }
  return map;
}

async function readPrevious(): Promise<Content | null> {
  try {
    const raw = await readFile(OUTPUT, 'utf8');
    return JSON.parse(raw) as Content;
  } catch {
    return null;
  }
}

async function readManualSeed(): Promise<Map<string, Enrichment>> {
  try {
    const raw = await readFile(MANUAL_SEED, 'utf8');
    const data = JSON.parse(raw) as Record<string, Enrichment>;
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function fallbackGrammar(skipAi: boolean) {
  return {
    title: 'Powtórka słownictwa',
    explanation: skipAi
      ? 'Tryb bez AI: reguła gramatyczna zostanie wygenerowana przy następnym uruchomieniu pipeline z kluczem GEMINI_API_KEY.'
      : 'Dziś koncentrujemy się na praktyce wybranych słów i wyrażeń w naturalnych zdaniach.',
    examples: [],
  };
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return '<invalid url>';
  }
}

main().catch((err) => {
  console.error('[update] failed:', err);
  process.exit(1);
});
