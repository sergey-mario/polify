import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Content, Word } from './types.js';
import { fetchSheetCsv, normalizeRows, parseCsv, rowsToWords } from './fetch-sheet.js';
import { enrichWords, generateGrammarRule } from './enrich-with-ai.js';
import { pickDailyWords } from './generate-daily-practice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'public/data/content.json');

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTkchKrWgHRG4t_oXpHAcUhIrjtxSmEjWOycdzUXdLdNgukuhm-2XciZHcUaLDV0UGHhcibWgjQpJA_/pub?output=csv';

async function main(): Promise<void> {
  const sheetUrl = process.env.GOOGLE_SHEETS_CSV_URL ?? DEFAULT_SHEET_URL;
  const apiKey = process.env.GEMINI_API_KEY;
  const skipAi = !apiKey || process.env.SKIP_AI === '1';

  console.log(`[update] fetching sheet: ${redactUrl(sheetUrl)}`);
  const csv = await fetchSheetCsv(sheetUrl);
  const rows = normalizeRows(parseCsv(csv));
  const baseWords = rowsToWords(rows);
  console.log(`[update] parsed ${baseWords.length} rows from sheet`);

  let enriched: Word[];
  if (skipAi) {
    console.log('[update] SKIP_AI active — leaving words un-enriched (aiStatus=partial)');
    enriched = baseWords;
  } else {
    console.log('[update] enriching words with Gemini Flash');
    enriched = await enrichWords(baseWords, apiKey!);
  }

  const yesterdayIds = await readYesterdayDailyIds();
  const dailyWords = pickDailyWords(enriched, yesterdayIds, 10);
  console.log(`[update] selected ${dailyWords.length} daily words (excluded ${yesterdayIds.size} from yesterday)`);

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const grammarRule = skipAi
    ? {
        title: 'Powtórka słownictwa',
        explanation: 'Tryb bez AI: reguła gramatyczna zostanie wygenerowana przy następnym uruchomieniu pipeline z kluczem GEMINI_API_KEY.',
        examples: [],
      }
    : await generateGrammarRule(dailyWords, apiKey!);

  const content: Content = {
    generatedAt: today.toISOString(),
    dailyPractice: {
      date: isoDate,
      words: dailyWords,
      grammarRule,
    },
    allWords: enriched,
    metadata: {
      source: 'google-sheets-csv',
      totalWords: enriched.length,
      validWords: enriched.filter((w) => w.aiStatus === 'complete').length,
      partialWords: enriched.filter((w) => w.aiStatus === 'partial').length,
      uncertainWords: enriched.filter((w) => w.aiStatus === 'uncertain').length,
    },
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(`[update] wrote ${OUTPUT}`);
}

async function readYesterdayDailyIds(): Promise<Set<string>> {
  try {
    const raw = await readFile(OUTPUT, 'utf8');
    const prev = JSON.parse(raw) as Content;
    return new Set(prev.dailyPractice?.words?.map((w) => w.id) ?? []);
  } catch {
    return new Set();
  }
}

function redactUrl(url: string): string {
  // Published-CSV URLs are not secrets, but redact anyway in case a private link is set.
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
