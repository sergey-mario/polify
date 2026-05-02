import { useMemo, useState } from 'react';
import type { AiStatus, ContentMetadata, Word } from '../types.js';
import { WordCard } from './WordCard.js';

type StatusFilter = 'all' | AiStatus;

interface Props {
  words: Word[];
  metadata: ContentMetadata;
}

export function AllContent({ words, metadata }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
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
  }, [words, query, status]);

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
      </div>

      <div className="all-content__count">
        Wyświetlono {filtered.length} z {words.length}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Brak wyników.</div>
      ) : (
        <div className="word-grid">
          {filtered.map((w) => (
            <WordCard key={w.id} word={w} />
          ))}
        </div>
      )}
    </section>
  );
}
