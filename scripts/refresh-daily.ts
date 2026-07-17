import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Content } from './types.js';
import { pickDailyWords } from './generate-daily-practice.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'public/data/content.json');

// Reshuffles dailyPractice from the already-enriched allWords pool. Never
// fetches the sheet and never calls Gemini — vocabulary content is untouched.
async function main(): Promise<void> {
  const raw = await readFile(OUTPUT, 'utf8');
  const previous = JSON.parse(raw) as Content;

  const yesterdayIds = new Set(previous.dailyPractice?.words?.map((w) => w.id) ?? []);
  const dailySelection = pickDailyWords(previous.allWords, yesterdayIds, 10);

  if (dailySelection.length === 0) {
    console.log('[refresh-daily] no eligible words found — leaving content.json untouched');
    return;
  }

  const today = new Date();
  const content: Content = {
    ...previous,
    generatedAt: today.toISOString(),
    dailyPractice: {
      date: today.toISOString().slice(0, 10),
      words: dailySelection,
      grammarRule: {
        title: 'Powtórka słownictwa',
        explanation: 'Dziś koncentrujemy się na praktyce wybranych słów i wyrażeń w naturalnych zdaniach.',
        examples: [],
      },
    },
  };

  await writeFile(OUTPUT, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(`[refresh-daily] wrote ${OUTPUT} — ${dailySelection.length} daily words for ${content.dailyPractice.date}`);
}

main().catch((err) => {
  console.error('[refresh-daily] failed:', err);
  process.exit(1);
});
