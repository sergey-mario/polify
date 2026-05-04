import type { Word } from './types.js';

export function isValidForDaily(w: Word): boolean {
  if (!w.polish) return false;
  if (!w.translationRu) return false;
  if (!w.example && !w.synonym) return false;
  if (w.aiStatus === 'uncertain') return false;
  return true;
}

export function pickDailyWords(
  all: Word[],
  yesterdayIds: ReadonlySet<string>,
  count = 10,
  rng: () => number = Math.random,
): Word[] {
  const valid = all.filter(isValidForDaily);
  if (valid.length === 0) return [];

  const fresh = valid.filter((w) => !yesterdayIds.has(w.id));
  const pool = fresh.length >= count ? fresh : valid;
  const shuffled = shuffle(pool, rng);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
