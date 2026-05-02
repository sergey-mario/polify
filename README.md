# Polify

Personal Polish learning web app. Static site (Vite + React) generated from a Google Sheets vocabulary list, enriched daily by Gemini Flash via GitHub Actions, and deployed to GitHub Pages.

See [`POLISH_LEARNING_APP_PLAN.md`](POLISH_LEARNING_APP_PLAN.md) for the full design.

## Architecture

```
Google Sheet (CSV) ──► GitHub Actions ──► Gemini Flash ──► public/data/content.json ──► GitHub Pages
```

- The browser reads `data/content.json` only. No backend, no AI calls in the browser, no auth.
- A daily workflow regenerates `content.json` and commits it; another workflow rebuilds and deploys the site.

## Local development

```bash
npm install
npm run dev          # Vite dev server
npm run build        # production build (dist/)
```

The app fetches `${BASE_URL}data/content.json`. To get content locally:

```bash
# Run the pipeline without AI (uses raw sheet data, marks rows as 'partial')
SKIP_AI=1 npm run update-content

# Or with Gemini (requires a key)
GEMINI_API_KEY=... npm run update-content
```

The default sheet URL is hardcoded in `scripts/update-content.ts` and can be overridden via `GOOGLE_SHEETS_CSV_URL`.

## Configuration

GitHub Actions uses these inputs:

| Name | Where | Required | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | repo secret | yes (for AI) | Without it, pipeline runs in `SKIP_AI` mode |
| `GOOGLE_SHEETS_CSV_URL` | repo variable or secret | optional | Defaults to the published sheet baked into the script |
| `GEMINI_MODEL` | repo variable | optional | Defaults to `gemini-2.0-flash` |

GitHub Pages: enable Pages → Source → "GitHub Actions" in repo settings. The `Deploy site` workflow handles the rest on every push to `main`.

## Project layout

```
.github/workflows/
  update-content.yml   # daily cron + manual: regenerates content.json
  deploy.yml           # builds Vite app and publishes to GitHub Pages
scripts/
  update-content.ts    # orchestrator
  fetch-sheet.ts       # CSV fetch + parse + normalize
  enrich-with-ai.ts    # Gemini Flash enrichment + grammar rule
  generate-daily-practice.ts  # picks 10 valid words, avoids yesterday's
src/
  App.tsx, components/, types.ts, styles.css
public/
  data/content.json    # generated; committed
```

## Constraints

The Google Sheet remains the human-edited source of truth. We never write enriched data back to it. The generated `content.json` is the app's data source.
