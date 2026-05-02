import { useMemo, useState } from 'react';
import type { AiStatus, ContentMetadata, Word } from '../types.js';
import { WordCard } from './WordCard.js';

type StatusFilter = 'all' | AiStatus;
type SortKey =
  | 'sheet'
  | 'sheet-desc'
  | 'added-desc'
  | 'added-asc'
  | 'polish-asc'
  | 'polish-desc'
  | 'russian-asc'
  | 'russian-desc';

interface Props {
  words: Word[];
  metadata: ContentMetadata;
}

const PL_COLLATOR = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });
const RU_COLLATOR = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

export function AllContent({ words, metadata }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('sheet');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = words.filter((w) => {
      if (status !== 'all' && w.aiStatus !== status) return false;
      if (!q) return true;
      const haystack = [
        w.polish,
        w.synonym ?? '',
        w.example ?? '',
        w.translationRu ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    return sortWords(filtered, sort);
  }, [words, query, status, sort]);

  return (
    <section className="all-content">
      <div className="all-content__controls">
        <input
          type="search"
          className="all-content__search"
          placeholder="Szukaj po polsku lub rosyjsku…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj"
        />
        <select
          className="all-content__filter"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          aria-label="Filtr statusu"
        >
          <option value="all">Wszystkie ({metadata.totalWords})</option>
          <option value="complete">Kompletne ({metadata.validWords})</option>
          <option value="partial">Częściowe ({metadata.partialWords})</option>
          <option value="uncertain">Niepewne ({metadata.uncertainWords})</option>
        </select>
        <select
          className="all-content__filter"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sortowanie"
        >
          <option value="sheet">Po kolejności (najstarsze → najnowsze)</option>
          <option value="sheet-desc">Po kolejności (najnowsze → najstarsze)</option>
          <option value="added-desc">Data dodania: najnowsze</option>
          <option value="added-asc">Data dodania: najstarsze</option>
          <option value="polish-asc">Polski: A → Z</option>
          <option value="polish-desc">Polski: Z → A</option>
          <option value="russian-asc">Rosyjski: А → Я</option>
          <option value="russian-desc">Rosyjski: Я → А</option>
        </select>
      </div>

      <div className="all-content__count">
        Wyświetlono {visible.length} z {words.length}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">Brak wyników.</div>
      ) : (
        <div className="word-grid">
          {visible.map((w) => (
            <WordCard key={w.id} word={w} />
          ))}
        </div>
      )}
    </section>
  );
}

function sortWords(words: Word[], key: SortKey): Word[] {
  if (key === 'sheet') return words;
  const indexed = words.map((w, i) => ({ w, i }));
  switch (key) {
    case 'sheet-desc':
      indexed.sort((a, b) => b.i - a.i);
      break;
    case 'polish-asc':
      indexed.sort((a, b) => PL_COLLATOR.compare(a.w.polish, b.w.polish));
      break;
    case 'polish-desc':
      indexed.sort((a, b) => PL_COLLATOR.compare(b.w.polish, a.w.polish));
      break;
    case 'russian-asc':
      indexed.sort((a, b) => compareRussian(a.w, b.w, 1));
      break;
    case 'russian-desc':
      indexed.sort((a, b) => compareRussian(a.w, b.w, -1));
      break;
    case 'added-desc':
      indexed.sort((a, b) => compareAdded(a.w, b.w, -1) || b.i - a.i);
      break;
    case 'added-asc':
      indexed.sort((a, b) => compareAdded(a.w, b.w, 1) || a.i - b.i);
      break;
  }
  return indexed.map((x) => x.w);
}

function compareRussian(a: Word, b: Word, dir: 1 | -1): number {
  // Words without a Russian translation always sort to the bottom.
  const ar = a.translationRu ?? '';
  const br = b.translationRu ?? '';
  if (!ar && !br) return 0;
  if (!ar) return 1;
  if (!br) return -1;
  return dir * RU_COLLATOR.compare(ar, br);
}

function compareAdded(a: Word, b: Word, dir: 1 | -1): number {
  // Words without firstSeenAt sink to the bottom of either sort direction.
  const aD = a.firstSeenAt ?? '';
  const bD = b.firstSeenAt ?? '';
  if (!aD && !bD) return 0;
  if (!aD) return 1;
  if (!bD) return -1;
  return dir * aD.localeCompare(bD);
}
