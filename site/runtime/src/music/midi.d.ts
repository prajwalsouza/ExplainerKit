// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { MusicScore, MusicScoreInput } from './score.js';

export interface MidiReadResult {
  readonly format: 0 | 1;
  readonly score: MusicScore;
  readonly warnings: readonly { readonly code: string; readonly count: number }[];
}
export function readMidi(input: Uint8Array): MidiReadResult;
export function writeMidi(input: MusicScoreInput, options?: { readonly format?: 0 | 1 }): Uint8Array;
