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
        <span>Daily set: {date}</span>
        <span>Generated at {generatedLabel}</span>
      </div>

      {words.length === 0 ? (
        <div className="empty-state">
          No words available yet. Once the pipeline runs with AI enrichment, your
          daily set will appear here.
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
