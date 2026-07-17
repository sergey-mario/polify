---
name: update-content
description: Refresh Polify's public/data/content.json from the Google Sheet, and yourself fill in Russian translations, a synonym and example sentence for any Polish vocabulary that's missing them, and today's "Reguła gramatyczna" (grammar rule) for the daily practice set — without ever calling Gemini. Use this whenever the user asks to "update content," "sync the sheet," "add translations for new words," "add synonyms/examples," "write a grammar rule," "generate today's grammar rule," "run the pipeline," or mentions that words in the vocabulary sheet are missing a translation, synonym, or example, or that the grammar rule section needs filling in. Also trigger if a run of `npm run update-content` reports words missing `translationRu`, `synonym`, or `example`, or leaves the grammar rule as the generic placeholder, and the user wants it filled in without burning Gemini's free-tier quota.
---

# Update content (manual translation, no Gemini)

Polify's data pipeline (see the project's `CLAUDE.md` for full architecture) normally calls
Gemini to translate new words, but Gemini's free tier is capped at 20 requests/day and the
user prefers to do this translation pass themselves, using you (Claude Code on their laptop),
during a manual run. This skill is that manual run. **Never set `GEMINI_API_KEY` and never
call Gemini for this task** — always run the pipeline with `SKIP_AI=1`.

A word isn't done just because it has a translation. Each entry ideally has three things:
`translationRu` (what it means), `synonym` (a related Polish word, for building vocabulary
breadth), and `example` (a natural Polish sentence showing how it's actually used). A
translation alone leaves the learner without any sense of how the word behaves — this skill
covers all three, filling in whichever of the three a word is missing.

## Why this shape

`scripts/update-content.ts` fetches the sheet, merges cached enrichments, and only calls
Gemini for words still missing `translationRu` — it never auto-fills `synonym`/`example`
gaps for already-translated words. With `SKIP_AI=1` the Gemini call is skipped entirely and
the script just reports what's missing. Your job is to fill those gaps directly — the same
way a human translator and language teacher would — by writing entries into
`data/manual-enrichments.json`, which the pipeline treats as the lowest-priority enrichment
source (sheet-provided `synonym`/`example` still win over it; see `applyEnrichment` in
`scripts/update-content.ts`). The merge logic there fills in `synonym`/`example` from the
manual seed even when a word is already cached with a translation from a previous run — so
adding them later, after a word already has a translation, works correctly.

## Steps

1. **Install deps if needed**: `npm install` (only if `node_modules/.bin/tsx` is missing).

2. **Run the pipeline in no-AI mode** to pull the latest sheet and see what's missing:
   ```bash
   SKIP_AI=1 npm run update-content
   ```
   This fetches the live sheet, merges `public/data/content.json` (previous cache) and
   `data/manual-enrichments.json` (manual seed), and writes a fresh `content.json`. The
   console output tells you how many words are `partial`/`uncertain`.

3. **List what's missing**, broken out by which field is absent — a word can be missing
   its translation, its synonym, its example, or several at once:
   ```bash
   node -e "
   const data = require('./public/data/content.json');
   const seen = new Set();
   const rows = [];
   for (const w of data.allWords) {
     if (seen.has(w.polish)) continue;
     seen.add(w.polish);
     if (!w.translationRu || !w.synonym || !w.example) {
       rows.push({
         polish: w.polish,
         needsTranslation: !w.translationRu,
         needsSynonym: !w.synonym,
         needsExample: !w.example,
       });
     }
   }
   console.log(rows.length);
   console.log(JSON.stringify(rows, null, 2));
   "
   ```
   Dedupe by polish text before translating — the sheet has near-duplicate rows, and
   `manual-enrichments.json` is keyed by exact polish text, so one entry covers every
   duplicate. Words that already have a translation but lack a synonym or example still
   need attention — don't limit yourself to words with no translation at all.

4. **Watch for section-marker leakage**: the sheet uses date rows (e.g. `23.02.2026`) as
   section dividers, filtered out by `DATE_ROW` in `scripts/fetch-sheet.ts`. If you see
   date-shaped strings in the "missing" list (any separator — dots, slashes, whatever),
   that regex isn't catching them; widen it rather than translating fake "words." Don't
   add junk date strings to `manual-enrichments.json`.

5. **For each word, fill in whichever of translation/synonym/example it's missing,
   yourself.** You're fluent enough to do this directly — don't reach for Gemini or any
   other translation API or dictionary tool. A few things that make Polify's data good
   instead of just technically complete:
   - The sheet is full of hand-typed notes, not a clean word list: expect typos
     (`zAmiast` for `zamiast`), grammar fragments (`w zeszłym` clearly means "w zeszłym
     roku" but is missing the noun), shorthand (`im//tym` = the `im...tym` comparative
     construction), and slang (`git`, `luz`, `olewać`). Translate what's actually there,
     and note the correction/context in parentheses when it helps — e.g.
     `"опечатка от zamiast"` or `"обрывок фразы"` — the same pattern already used
     throughout `data/manual-enrichments.json`.
   - A synonym should be a real, commonly-used Polish word or short phrase — not a
     stretch. If nothing natural comes to mind (single-use idioms, grammar fragments,
     one-off proper nouns), skip the synonym rather than force one; `synonym` is optional.
   - An example should be one natural, grammatically correct Polish sentence that uses
     the word/phrase in a plausible everyday context — the kind of sentence you'd find
     in a dictionary entry, not something contrived just to contain the word. Skip the
     example if the word is itself already a full example sentence, a slur/pejorative
     term where an invented usage sentence would be gratuitous, or too fragmentary to
     use naturally (grammar notes like "im...tym" pattern reminders don't need one).
   - Pick `aiStatus: "complete"` when you're confident in the translation, `"partial"`
     for genuine fragments/idioms where the meaning is a best guess, and reserve
     `"uncertain"` for cases you truly can't resolve (uncertain entries get excluded
     from the daily practice set — see `scripts/generate-daily-practice.ts`).
   - A few sheet entries are informal/pejorative ethnonyms or slang. Translate them
     plainly and neutrally, the way a dictionary would gloss slang, without embellishing,
     and don't invent an example sentence for these.

6. **Add or update the entries in `data/manual-enrichments.json`**, keyed by the exact
   Polish text (matching case/spacing exactly as it appears in `content.json`'s `polish`
   field). If a word already has an entry (e.g. it has a translation from a previous
   run but is missing a synonym/example), merge into the existing entry rather than
   overwriting its `translationRu`/`aiStatus`:
   ```json
   "słowo": {"translationRu": "перевод", "synonym": "podobne słowo", "example": "Przykładowe zdanie ze słowem.", "aiStatus": "complete"}
   ```
   For a large batch of additions, it's faster and safer to write a small one-off Node
   script that reads `data/manual-enrichments.json`, merges an object of `{polish: {synonym,
   example}}` additions into the existing entries (spread the existing entry first so you
   don't clobber `translationRu`), writes the file back, and reports how many keys it
   couldn't find — that catches typos in your own keys before they silently no-op. Delete
   the scratch script when you're done; it's not part of the repo. Validate the file
   parses before moving on: `node -e "JSON.parse(require('fs').readFileSync('data/manual-enrichments.json','utf8'))"`.

7. **Re-run the pipeline** to fold the new translations in:
   ```bash
   SKIP_AI=1 npm run update-content
   ```
   Then re-run the step 3 script and confirm the missing-fields list has shrunk to
   (ideally) nothing, or just the handful you deliberately left incomplete (uncertain
   translations, or words where a synonym/example genuinely doesn't apply). If a word
   already had a translation from before and you only added synonym/example, double
   check it actually landed in `content.json` — spot check with:
   ```bash
   node -e "console.log(JSON.stringify(require('./public/data/content.json').allWords.find(w => w.polish === 'słowo')))"
   ```
   This has bitten this pipeline before: a word cached with only a translation used to
   permanently shadow manual-seed synonym/example additions for that word, because the
   cache lookup short-circuited before ever consulting the manual seed. That's fixed now
   (manual seed fills in whichever fields the cache entry is missing), but it's worth this
   spot check since a silent no-op here is easy to miss.

8. **Write today's grammar rule yourself.** `content.json`'s `dailyPractice.grammarRule`
   (rendered in the app as "Reguła gramatyczna") is normally written by Gemini, tailored
   to that day's 10 daily words — `SKIP_AI=1` skips that call and leaves a generic
   placeholder (`"Powtórka słownictwa"` with an empty `examples` array) instead. Replace
   that placeholder with a real rule, the same way a Polish teacher would build a mini
   lesson around today's vocabulary:
   - Read `dailyPractice.words` from the just-written `content.json` — that's the exact
     set of 10 words/phrases you're building the rule around.
   - Pick one grammar rule, tense, case, verb pattern, or syntactic construction that
     several of those words actually illustrate (not all 10 need to fit — a rule that
     genuinely connects 3-4 of them is better than a vague one stretched over all of
     them). If nothing in the set suggests a clean rule, it's fine to cover a related
     usage pattern (e.g. a group of reflexive verbs, or a comparative construction)
     instead of a strict grammar-textbook rule.
   - Write it in Polish, matching the shape the app expects:
     ```json
     {
       "title": "Krótki tytuł reguły",
       "explanation": "1-3 proste zdania po polsku, wyjaśniające regułę.",
       "examples": ["Przykładowe zdanie 1.", "Przykładowe zdanie 2."]
     }
     ```
     2-4 short example sentences, ideally reusing today's daily words where it reads
     naturally rather than forcing every single one in.
   - Patch it into `public/data/content.json` directly (rewriting `content.json` from
     scratch would lose the words/translations you just wrote) — a small one-off Node
     script that reads the file, sets `dailyPractice.grammarRule` to your object, and
     writes it back is the safest way. Delete the scratch script afterward.
   - This step is specific to `content.json`'s current `dailyPractice` — it does not
     touch `data/manual-enrichments.json`, and it does not survive re-running
     `update-content` (that regenerates `dailyPractice` and reverts to the placeholder,
     since the grammar rule isn't cached/seeded like word data is). Do this step last,
     after any translation/synonym/example work, so a later pipeline re-run doesn't wipe
     it out. If the daily words get reshuffled later by `refresh-daily.yml`'s cron, that
     workflow still writes the static placeholder — it has no Claude in the loop to
     author a fresh rule for the new set, by design (see that workflow's own history).

9. **Typecheck and sanity-check the diff** before considering this done:
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
- Don't force a synonym or example onto a word where one doesn't naturally fit — an
  empty field is better than a contrived one. Leave `synonym`/`example` out rather than
  padding the data with something unnatural.
