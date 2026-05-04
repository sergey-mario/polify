export type AiStatus = 'complete' | 'partial' | 'uncertain';

export interface Word {
  id: string;
  polish: string;
  synonym?: string;
  example?: string;
  translationRu?: string;
  aiStatus: AiStatus;
  /** ISO date (YYYY-MM-DD) the word first appeared in the pipeline output. */
  firstSeenAt?: string;
}

export interface GrammarRule {
  title: string;
  explanation: string;
  examples: string[];
}

export interface DailyPractice {
  date: string;
  words: Word[];
  grammarRule: GrammarRule;
}

export interface ContentMetadata {
  source: string;
  totalWords: number;
  validWords: number;
  partialWords: number;
  uncertainWords: number;
}

export interface Content {
  generatedAt: string;
  dailyPractice: DailyPractice;
  allWords: Word[];
  metadata: ContentMetadata;
}
