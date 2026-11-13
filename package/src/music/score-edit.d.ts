// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { MusicNoteInput, MusicScore, MusicScoreInput } from './score.js';

export type MusicNoteEdit = Partial<Omit<MusicNoteInput, 'id'>> & { readonly id: string; readonly remove?: boolean };
export interface MusicPhraseRepetition {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly at: number;
  readonly tracks?: readonly string[];
  readonly transpose?: number;
  readonly velocityScale?: number;
}
export function editMusicNotes(input: MusicScoreInput, edits: readonly MusicNoteEdit[]): MusicScore;
export function repeatMusicPhrase(input: MusicScoreInput, spec: MusicPhraseRepetition): MusicScore;
