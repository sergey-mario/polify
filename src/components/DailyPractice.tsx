import type { DailyPractice as DailyPracticeT } from '../types.js';
import { WordCard } from './WordCard.js';

interface Props {
  practice: DailyPracticeT;
  generatedLabel: string;
}

export function DailyPractice({ practice, generatedLabel }: Props) {
  const { words, grammarRule, date } = practice;
  return (
    <section className="daily">
      <div className="daily__meta">
        <span>Zestaw na dzień: {date}</span>
        <span>Wygenerowano {generatedLabel}</span>
      </div>

      {words.length === 0 ? (
        <div className="empty-state">
          Brak dostępnych słów. Po uruchomieniu pipeline'u z włączonym AI
          codzienny zestaw pojawi się tutaj.
        </div>
      ) : (
        <div className="word-grid">
          {words.map((w) => (
            <WordCard key={w.id} word={w} />
          ))}
        </div>
      )}

      <section className="grammar">
        <h2 className="grammar__title">{grammarRule.title}</h2>
        <p className="grammar__explanation">{grammarRule.explanation}</p>
        {grammarRule.examples.length > 0 && (
          <ul className="grammar__examples">
            {grammarRule.examples.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
