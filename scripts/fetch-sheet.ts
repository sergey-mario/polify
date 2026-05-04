import type { Word } from './types.js';

interface RawRow {
  polish: string;
  synonym: string;
  example: string;
}

const DATE_ROW = /^\d{1,2}\.\d{1,2}\.\d{2,4}$/;

export async function fetchSheetCsv(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet CSV: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// Minimal RFC 4180 CSV parser: handles quoted fields, embedded commas, and
// escaped quotes (""). Sufficient for Google Sheets published CSV.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function normalizeRows(rows: string[][]): RawRow[] {
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  // Map header positions defensively (the published sheet has trailing empty cols).
  const idx = {
    polish: header.findIndex((h) => h.trim().toLowerCase() === 'słowo'),
    synonym: header.findIndex((h) => h.trim().toLowerCase() === 'synonim'),
    example: header.findIndex((h) => h.trim().toLowerCase() === 'przykład'),
  };
  // Fall back to positional mapping if header lookup fails.
  if (idx.polish === -1) idx.polish = 0;
  if (idx.synonym === -1) idx.synonym = 1;
  if (idx.example === -1) idx.example = 2;

  const out: RawRow[] = [];
  for (const r of body) {
    const polish = (r[idx.polish] ?? '').trim();
    if (!polish) continue;
    if (DATE_ROW.test(polish)) continue; // section markers in source sheet
    out.push({
      polish,
      synonym: (r[idx.synonym] ?? '').trim(),
      example: (r[idx.example] ?? '').trim(),
    });
  }
  return out;
}

export function rowsToWords(rows: RawRow[]): Word[] {
  const used = new Set<string>();
  return rows.map((r) => {
    const id = makeId(r.polish, used);
    const word: Word = {
      id,
      polish: r.polish,
      aiStatus: 'partial', // pre-enrichment: we only have human input
    };
    if (r.synonym) word.synonym = r.synonym;
    if (r.example) word.example = r.example;
    return word;
  });
}

function makeId(polish: string, used: Set<string>): string {
  const base = polish
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'word';
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n++}`;
  }
  used.add(id);
  return id;
}
