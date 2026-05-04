import { useEffect, useMemo, useState } from 'react';
import type { Content } from './types.js';
import { Tabs } from './components/Tabs.js';
import { DailyPractice } from './components/DailyPractice.js';
import { AllContent } from './components/AllContent.js';
import { Logo } from './components/Logo.js';

type TabKey = 'daily' | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'daily', label: 'Codzienna praktyka' },
  { key: 'all', label: 'Cały słownik' },
];

const CONTENT_URL = `${import.meta.env.BASE_URL}data/content.json`;

export default function App() {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('daily');

  useEffect(() => {
    let cancelled = false;
    fetch(CONTENT_URL, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Content>;
      })
      .then((data) => {
        if (!cancelled) setContent(data);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generatedLabel = useMemo(() => {
    if (!content) return '';
    try {
      return new Date(content.generatedAt).toLocaleString();
    } catch {
      return content.generatedAt;
    }
  }, [content]);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <Logo />
          <h1 className="app__title">Polify</h1>
        </div>
        <p className="app__subtitle">Nauka polskiego · praktyka osobista</p>
      </header>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <main className="app__main">
        {error && (
          <div className="empty-state">
            Nie udało się wczytać treści: {error}
          </div>
        )}
        {!error && !content && <div className="empty-state">Wczytywanie…</div>}
        {content && tab === 'daily' && (
          <DailyPractice
            practice={content.dailyPractice}
            generatedLabel={generatedLabel}
          />
        )}
        {content && tab === 'all' && (
          <AllContent words={content.allWords} metadata={content.metadata} />
        )}
      </main>
      {content && (
        <footer className="app__footer">
          Wygenerowano {generatedLabel} · {content.metadata.totalWords} słów ·{' '}
          {content.metadata.validWords} kompletnych · {content.metadata.partialWords} częściowych ·{' '}
          {content.metadata.uncertainWords} niepewnych
        </footer>
      )}
    </div>
  );
}
