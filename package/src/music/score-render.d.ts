// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { MusicScoreInput } from './score.js';
import type { ScoreInstrument } from './score-voices.js';
import type { SampleBank } from '../sound/samples.js';

export interface MusicTrackRenderOptions {
  readonly id: string;
  readonly instrument?: ScoreInstrument;
  readonly sample?: { readonly bank: SampleBank; readonly release?: number };
  readonly gain?: number;
  readonly pan?: number;
}
export interface MusicScoreRenderOptions {
  readonly sampleRate?: number;
  readonly tail?: number;
  readonly space?: number;
  readonly gain?: number;
  readonly stems?: boolean;
  readonly tracks?: readonly MusicTrackRenderOptions[];
}
export interface MusicScoreRender {
  readonly channels: readonly [Float32Array, Float32Array];
  readonly sampleRate: number;
  readonly duration: number;
  readonly peak: number;
  readonly clippedSamples: number;
  readonly stems: readonly { readonly id: string; readonly channels: readonly [Float32Array, Float32Array] }[];
}
export function renderMusicScore(input: MusicScoreInput, options?: MusicScoreRenderOptions): MusicScoreRender;
