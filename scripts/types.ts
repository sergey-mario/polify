// Re-export shared types for the Node-side pipeline so scripts don't import
// from the browser source tree (keeps tsconfig boundaries clean).
export type {
  AiStatus,
  Word,
  GrammarRule,
  DailyPractice,
  ContentMetadata,
  Content,
} from '../src/types.js';
