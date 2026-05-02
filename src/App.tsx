import { useEffect, useMemo, useState } from 'react';
import type { Content } from './types.js';
import { Tabs } from './components/Tabs.js';
import { DailyPractice } from './components/DailyPractice.js';
import { AllContent } from './components/AllContent.js';

type TabKey = 'daily' | 'all';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'daily', label: 'Daily Practice' },
  { key: 'all', label: 'All Content' },
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
        <h1 className="app__title">Polify</h1>
        <p className="app__subtitle">Polish learning · personal practice</p>
      </header>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <main className="app__main">
        {error && (
          <div className="empty-state">
            Could not load content: {error}
          </div>
        )}
        {!error && !content && <div className="empty-state">Loading…</div>}
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
          Generated at {generatedLabel} · {content.metadata.totalWords} words ·{' '}
          {content.metadata.validWords} complete · {content.metadata.partialWords} partial ·{' '}
          {content.metadata.uncertainWords} uncertain
        </footer>
      )}
    </div>
  );
}
