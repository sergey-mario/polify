---
name: update-content
description: Refresh Polify's public/data/content.json from the Google Sheet and translate any newly-added Polish vocabulary into Russian yourself, without ever calling Gemini. Use this whenever the user asks to "update content," "sync the sheet," "add translations for new words," "run the pipeline," or mentions that new words were added to the vocabulary sheet and need Russian translations. Also trigger if a run of `npm run update-content` reports words missing `translationRu` and the user wants them filled in without burning Gemini's free-tier quota.
---

# Update content (manual translation, no Gemini)

Polify's data pipeline (see the project's `CLAUDE.md` for full architecture) normally calls
Gemini to translate new words, but Gemini's free tier is capped at 20 requests/day and the
user prefers to do this translation pass themselves, using you (Claude Code on their laptop),
during a manual run. This skill is that manual run. **Never set `GEMINI_API_KEY` and never
call Gemini for this task** — always run the pipeline with `SKIP_AI=1`.

## Why this shape

`scripts/update-content.ts` fetches the sheet, merges cached enrichments, and only calls
Gemini for words still missing `translationRu`. With `SKIP_AI=1` it skips that call and
just reports what's still missing. Your job is to fill those gaps directly — the same way
a human translator would — by writing entries into `data/manual-enrichments.json`, which
the pipeline treats as the lowest-priority enrichment source (sheet-provided `synonym`/
`example` still win over it; see `applyEnrichment` in `scripts/update-content.ts`).

## Steps

1. **Install deps if needed**: `npm install` (only if `node_modules/.bin/tsx` is missing).

2. **Run the pipeline in no-AI mode** to pull the latest sheet and see what's missing:
   ```bash
   SKIP_AI=1 npm run update-content
   ```
   This fetches the live sheet, merges `public/data/content.json` (previous cache) and
   `data/manual-enrichments.json` (manual seed), and writes a fresh `content.json`. The
   console output tells you how many words are `partial`/`uncertain`.

3. **List the words still missing a translation**:
   ```bash
   node -e "
   const data = require('./public/data/content.json');
   const missing = [...new Set(data.allWords.filter(w => !w.translationRu).map(w => w.polish))];
   console.log(missing.length);
   console.log(JSON.stringify(missing));
   "
   ```
   Dedupe by polish text before translating — the sheet has near-duplicate rows, and
   `manual-enrichments.json` is keyed by exact polish text, so one entry covers every
   duplicate.

4. **Watch for section-marker leakage**: the sheet uses date rows (e.g. `23.02.2026`) as
   section dividers, filtered out by `DATE_ROW` in `scripts/fetch-sheet.ts`. If you see
   date-shaped strings in the "missing" list (any separator — dots, slashes, whatever),
   that regex isn't catching them; widen it rather than translating fake "words." Don't
   add junk date strings to `manual-enrichments.json`.

5. **Translate each real word/phrase into Russian yourself.** You're fluent enough to do
   this directly — don't reach for Gemini or any other translation API. A few things that
   make Polify's data good instead of just technically complete:
   - The sheet is full of hand-typed notes, not a clean word list: expect typos
     (`zAmiast` for `zamiast`), grammar fragments (`w zeszłym` clearly means "w zeszłym
     roku" but is missing the noun), shorthand (`im//tym` = the `im...tym` comparative
     construction), and slang (`git`, `luz`, `olewać`). Translate what's actually there,
     and note the correction/context in parentheses when it helps — e.g.
     `"опечатка от zamiast"` or `"обрывок фразы"` — the same pattern already used
     throughout `data/manual-enrichments.json`.
   - Pick `aiStatus: "complete"` when you're confident in the translation, `"partial"`
     for genuine fragments/idioms where the meaning is a best guess, and reserve
     `"uncertain"` for cases you truly can't resolve (uncertain entries get excluded
     from the daily practice set — see `scripts/generate-daily-practice.ts`).
   - A few sheet entries are informal/pejorative ethnonyms or slang. Translate them
     plainly and neutrally, the way a dictionary would gloss slang, without embellishing.

6. **Add the entries to `data/manual-enrichments.json`**, keyed by the exact Polish text
   (matching case/spacing exactly as it appears in `content.json`'s `polish` field), in
   the same shape as existing entries:
   ```json
   "słowo": {"translationRu": "перевод", "aiStatus": "complete"}
   ```
   Add `"example"` only if you can write a natural Polish sentence using the word — it's
   optional and the sheet's own `example` column always wins over it anyway. Validate the
   file parses before moving on: `node -e "JSON.parse(require('fs').readFileSync('data/manual-enrichments.json','utf8'))"`.

7. **Re-run the pipeline** to fold the new translations in:
   ```bash
   SKIP_AI=1 npm run update-content
   ```
   Confirm the "missing" count from step 3 has dropped to (ideally) zero, or just the
   handful you deliberately left as `uncertain`.

8. **Typecheck and sanity-check the diff** before considering this done:
   ```bash
   npm run typecheck
   git diff --stat data/manual-enrichments.json public/data/content.json
   ```
   Don't commit or push unless the user explicitly asks — this skill's job ends at
   producing a correct, reviewable diff.

## What NOT to do

- Never set or use `GEMINI_API_KEY` for this task, even if it's available in the
  environment — the whole point is to keep this pipeline run free.
- Never write enriched data back to the Google Sheet — it's the human-edited source of
  truth (see the project's `CLAUDE.md`).
- Don't invent translations for entries you're genuinely unsure about — mark them
  `"uncertain"` instead of guessing, since that's what keeps them out of the daily
  practice rotation until a human resolves them.
