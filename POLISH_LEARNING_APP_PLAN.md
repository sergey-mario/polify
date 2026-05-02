# Implementation Plan: Polish Learning App

## Goal

Build a small personal, non-commercial Polish learning web app.

The app should:

- Use Google Sheets as the raw vocabulary source.
- Read the sheet through a public published CSV URL.
- Use GitHub Actions to generate a static JSON file.
- Use Gemini Flash in the GitHub Actions pipeline to enrich incomplete vocabulary items.
- Deploy a static Vite + React app to GitHub Pages.
- Provide two tabs:
  - `Daily Practice`
  - `All Content`

The app should not have login, backend, offline support, or AI calls from the browser.

## Source Data

The Google Sheets table currently has these columns:

```text
słowo | synonim | przykład
```

Map them internally as:

```text
słowo     -> polish
synonim   -> synonym
przykład  -> example
```

The website UI and code should be in English, but Polish vocabulary and grammar content should remain in Polish where appropriate.

## Generated Data

The pipeline should generate a static JSON file, for example:

```text
public/data/content.json
```

Suggested JSON shape:

```json
{
  "generatedAt": "2026-05-02T08:00:00.000Z",
  "dailyPractice": {
    "date": "2026-05-02",
    "words": [],
    "grammarRule": {
      "title": "",
      "explanation": "",
      "examples": []
    }
  },
  "allWords": [],
  "metadata": {
    "source": "google-sheets-csv",
    "totalWords": 0,
    "validWords": 0,
    "partialWords": 0,
    "uncertainWords": 0
  }
}
```

Each word should have this shape:

```json
{
  "id": "potknac-sie",
  "polish": "potknąć się",
  "synonym": "stracić równowagę",
  "example": "Potknął się o kamień.",
  "translationRu": "споткнуться",
  "aiStatus": "complete"
}
```

Allowed `aiStatus` values:

```text
complete
partial
uncertain
```

Rules:

- `complete`: all important fields are filled and AI is confident.
- `partial`: some fields are missing, but the item can still be displayed.
- `uncertain`: AI is not confident about the meaning or the generated content.

## GitHub Actions Pipeline

Create a GitHub Actions workflow that supports:

- Scheduled daily run.
- Manual run through `workflow_dispatch`.

Pipeline steps:

1. Checkout repository.
2. Install dependencies.
3. Fetch the public Google Sheets CSV.
4. Parse CSV rows.
5. Normalize rows into internal word objects.
6. Detect missing fields:
   - missing synonym
   - missing example
   - missing Russian translation
7. Call Gemini Flash to enrich incomplete rows.
8. Generate 10 random valid words for `Daily Practice`.
9. Prefer not to repeat yesterday's daily set if this is easy to implement.
10. Generate one grammar rule in Polish based on the selected daily words.
11. Write `public/data/content.json`.
12. Commit the updated JSON back to the repository if it changed.
13. Let GitHub Pages deploy the static site.

The AI API key should be stored in GitHub Secrets as:

```text
GEMINI_API_KEY
```

The public Google Sheets CSV URL should be stored either as a GitHub Secret or repository variable:

```text
GOOGLE_SHEETS_CSV_URL
```

## AI Integration

Use Gemini Flash from the GitHub Actions script only.

The browser app must not call Gemini or expose any AI API key.

The enrichment prompt should follow this intent:

```text
You are helping someone learn Polish.

For each Polish word or expression, enrich the item with:
- a Russian translation
- a natural Polish synonym, if appropriate
- a simple, popular, conversational Polish example

If the meaning is ambiguous, choose the most common conversational meaning, but do not invent a specialized or niche context.

Keep examples short, natural, and useful for language learning.

If you are not confident, set aiStatus to "uncertain".
If only part of the item can be enriched, set aiStatus to "partial".
If everything is clear and complete, set aiStatus to "complete".

Return strict JSON only.
```

The grammar rule prompt should generate the rule in Polish.

It should be based on the 10 selected daily words, not on a random unrelated topic.

Suggested grammar rule shape:

```json
{
  "title": "Czas przeszły czasowników zwrotnych",
  "explanation": "Czasowniki zwrotne w czasie przeszłym odmieniają się przez rodzaj i liczbę.",
  "examples": [
    "On potknął się o kamień.",
    "Ona potknęła się o kamień."
  ]
}
```

## Valid Word Selection

A word is valid for `Daily Practice` if it has at least:

- `polish`
- `translationRu`
- either `example` or `synonym`
- `aiStatus !== "uncertain"`

Select 10 random valid words.

If fewer than 10 valid words exist, show as many as available.

To avoid repeating yesterday's set, the script can read the previous `content.json` before overwriting it and exclude previous daily word IDs when possible.

## Frontend

Use:

```text
Vite + React
```

Deploy with:

```text
GitHub Pages
```

The frontend should read:

```text
/data/content.json
```

No backend is needed.

## UI Structure

The app should have two tabs:

```text
Daily Practice
All Content
```

### Daily Practice

Show:

- generation date
- 10 daily words
- grammar rule of the day

Each word card should show:

- Polish word/expression
- Russian translation
- Polish synonym if available
- Polish example if available
- visual status if `aiStatus` is `partial` or `uncertain`

### All Content

Show all words from the generated JSON, including problematic ones.

Add basic visual markers:

- `complete`: normal display
- `partial`: warning-style badge
- `uncertain`: stronger warning badge

All Content should preferably include:

- search by Polish word
- search by Russian translation
- status filter if simple to add

## Design Direction

Keep the UI simple, clean, and readable.

Prioritize:

- good typography
- readable cards
- mobile-friendly layout, but do not over-optimize for mobile
- minimal dependencies
- no complex state management

Use English for app UI labels.

Examples:

```text
Daily Practice
All Content
Search
Generated at
Synonym
Example
Translation
Status
Partial
Uncertain
```

## Important Constraints

Do not write enriched AI data back to Google Sheets.

Google Sheets remains the raw human-edited source.

The generated JSON is the app's actual data source.

Do not add authentication.

Do not add a backend.

Do not call AI from the browser.

Do not implement spaced repetition or progress tracking in this version.

## Recommended File Structure

Suggested structure:

```text
.github/workflows/update-content.yml
scripts/
  update-content.ts
  fetch-sheet.ts
  enrich-with-ai.ts
  generate-daily-practice.ts
src/
  App.tsx
  components/
    Tabs.tsx
    DailyPractice.tsx
    AllContent.tsx
    WordCard.tsx
  types.ts
public/
  data/
    content.json
```

The exact structure can be adjusted to match the project conventions.

## Success Criteria

The implementation is successful when:

- The site builds locally.
- The site can be deployed to GitHub Pages.
- The app loads static `content.json`.
- The `Daily Practice` tab shows 10 valid words and one Polish grammar rule.
- The `All Content` tab shows all imported words.
- Problematic AI entries are visually marked.
- GitHub Actions can run manually.
- GitHub Actions can run daily.
- No AI keys are exposed in frontend code.
