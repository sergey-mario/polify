import type { Word } from '../types.js';

interface WordCardProps {
  word: Word;
}

export function WordCard({ word }: WordCardProps) {
  return (
    <article className={`word-card word-card--${word.aiStatus}`}>
      <header className="word-card__header">
        <h3 className="word-card__polish">{word.polish}</h3>
        {word.aiStatus !== 'complete' && (
          <span className={`badge badge--${word.aiStatus}`}>
            {word.aiStatus === 'partial' ? 'Partial' : 'Uncertain'}
          </span>
        )}
      </header>
      {word.translationRu && (
        <p className="word-card__row">
          <span className="word-card__label">Translation</span>
          <span className="word-card__value">{word.translationRu}</span>
        </p>
      )}
      {word.synonym && (
        <p className="word-card__row">
          <span className="word-card__label">Synonym</span>
          <span className="word-card__value">{word.synonym}</span>
        </p>
      )}
      {word.example && (
        <p className="word-card__row word-card__row--example">
          <span className="word-card__label">Example</span>
          <span className="word-card__value">{word.example}</span>
        </p>
      )}
    </article>
  );
}
