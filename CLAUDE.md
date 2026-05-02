# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server (Local URL ends in /polify/, not /)
npm run build            # tsc -b && vite build (typecheck + production bundle)
npm run typecheck        # tsc -b --noEmit (run this after editing types/components)
npm run preview          # serve dist/ locally to test the production build
npm run update-content   # run the full data pipeline locally; writes public/data/content.json
SKIP_AI=1 npm run update-content   # same, but skip every Gemini call (no API key needed)
```

There are no unit tests in this project. Verification is "does the build pass + does the page render."

The Vite base path is hardcoded to `/polify/` (override via `VITE_BASE`). The dev server URL is therefore `http://localhost:5173/polify/`, not `http://localhost:5173/`.

## High-level architecture

This is a **personal, AI-enriched Polish vocabulary app**, deployed as a static site.

```
Google Sheet (CSV) ──▶ GitHub Actions ──▶ Gemini Flash ──▶ public/data/content.json ──▶ GitHub Pages
                       (scripts/update-content.ts)         (browser fetches this JSON; no backend, no auth)
```

The browser bundle has no AI keys, no backend, no auth. All enrichment happens in CI; the browser only reads the static JSON.

### Two GitHub Actions workflows form a self-perpetuating loop

- `update-content.yml` — daily cron + manual; runs the pipeline and **commits a fresh `public/data/content.json` to `main`** as the github-actions bot
- `deploy.yml` — runs on every push to `main`; rebuilds Vite and publishes to Pages

So the daily cron commit auto-triggers a redeploy. Don't break this contract: `public/data/content.json` is intentionally committed to git (it's the cache *and* the build artifact).

### The pipeline architecture is constrained by Gemini's free-tier quota

Free tier on `gemini-2.5-flash` is **20 requests/day per project** — the only Flash model with non-zero free quota on new AI Studio projects (verified empirically: `gemini-2.0-flash` and `-lite` both return `limit: 0`). 411 sheet rows in batches of 20 cannot be enriched daily within that budget. So the pipeline is **enrich-on-demand**:

1. Fetch the live sheet CSV.
2. Load the previous `public/data/content.json` as a per-word cache. Lookup priority: `id` → `polish` text → manual seed (`data/manual-enrichments.json`).
3. Apply cached enrichments (translation, synonym, example, status, `firstSeenAt`).
4. Pick today's 10 daily words preferring already-enriched ones; fall back to un-enriched candidates only if needed.
5. **Only call Gemini for daily words that still lack `translationRu`** (typically 0 in steady state).
6. One additional call to generate the day's grammar rule from the final daily set.

Steady-state CI cost: ~1 Gemini call/day. New words (added to the sheet) get enriched the first day they're picked for the daily set.

### `firstSeenAt` and the polish-text cache fallback

Each word is stamped with an ISO date the first time the pipeline sees it, then preserved in `content.json` forever. Lookup is **id-first, polish-text-second** because Google Sheets row reorders change positional IDs but not the Polish text. Without the polish-text fallback, reordering rows would silently lose enrichments.

### Manual seed (`data/manual-enrichments.json`)

Hand-authored Russian translations + examples keyed by exact polish text. Used as the lowest-priority fallback when neither id nor polish-text caches have an entry. **Sheet values for `synonym` and `example` always take precedence** over manual seed (see `applyEnrichment` in `scripts/update-content.ts`); manual seed only fills what the sheet leaves empty plus always provides `translationRu`. Mark uncertain entries with `aiStatus: "uncertain"` rather than guessing — uncertain entries are excluded from the daily set.

### Source data quirks

- The sheet has 411 rows but only ~398 unique Polish keys; duplicates resolve to the same enrichment by design.
- The sheet contains date-shaped rows (e.g. `23.02.2026`) that are section markers, not vocabulary. `normalizeRows` in `scripts/fetch-sheet.ts` filters them out.
- The sheet has no Russian column at all — `translationRu` only ever comes from AI or manual seed.
- The CSV header has a trailing comma producing an extra empty column; the parser handles this defensively by header lookup.

### Polish/Russian-aware sorting

`AllContent.tsx` uses `Intl.Collator('pl')` and `Intl.Collator('ru')` for alphabetical sorts, and a stable index-tiebreaker so equal keys preserve sheet order. Words missing `translationRu` always sink to the bottom in Russian sorts.

### Module resolution: `.js` extensions in TS imports

Imports use explicit `.js` extensions (e.g. `from './types.js'`) even though source files are `.ts`. This is the bundler-resolution convention required by the `"moduleResolution": "Bundler"` setting in `tsconfig.app.json`. Don't drop the extensions when adding new files.

### Architectural rules from the project plan

- Never write enriched data back to the sheet — sheet is the human-edited source of truth.
- Never call Gemini from the browser; never expose the key in the bundle.
- No spaced repetition, no progress tracking, no auth, no backend (intentional scope limit).

## Configuration that lives outside this repo

| Name | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | repo secret | required for any Gemini call in CI |
| `GOOGLE_SHEETS_CSV_URL` | repo variable or secret | overrides the published-CSV URL hardcoded in `scripts/update-content.ts` |
| `GEMINI_MODEL` | repo variable | overrides default `gemini-2.5-flash` |
| GitHub Pages source | repo Settings → Pages | must be set to **GitHub Actions** (not branch-based) for `deploy.yml` to publish |
