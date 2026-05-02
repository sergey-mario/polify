import { useMemo, useState } from 'react';
import type { AiStatus, ContentMetadata, Word } from '../types.js';
import { WordCard } from './WordCard.js';

type StatusFilter = 'all' | AiStatus;
type SortKey = 'sheet' | 'polish-asc' | 'polish-desc' | 'russian-asc' | 'russian-desc';

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
          <option value="sheet">Po kolejności</option>
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
  const out = words.slice();
  switch (key) {
    case 'polish-asc':
      out.sort((a, b) => PL_COLLATOR.compare(a.polish, b.polish));
      break;
    case 'polish-desc':
      out.sort((a, b) => PL_COLLATOR.compare(b.polish, a.polish));
      break;
    case 'russian-asc':
      out.sort((a, b) => compareRussian(a, b, 1));
      break;
    case 'russian-desc':
      out.sort((a, b) => compareRussian(a, b, -1));
      break;
  }
  return out;
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
