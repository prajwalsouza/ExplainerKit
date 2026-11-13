// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { Pitch } from './instruments.js';
import type { SoundPCM } from './pcm.js';
export interface PianoNoteOptions {
  sampleRate?: number;
  velocity?: number;
  hold?: number;
  tail?: number;
  hardness?: number;
  stiffness?: number;
  unison?: number;
  pedal?: boolean;
  micWidth?: number;
  body?: number;
  seed?: string | number;
  calibration?: boolean;
}
export interface ModeledPianoNote extends SoundPCM {
  readonly metadata: Readonly<{
    source: 'modeled-piano';
    midi: number;
    fundamentalHz: number;
    tunedFundamentalHz: number;
    calibration: 'salamander-v3' | 'none';
    partialHz: readonly number[];
    stringCount: number;
    unison: number;
    hammerContactMs: number;
    micDelayMs: number;
    stiffness: number;
    pedal: boolean;
  }>;
}
export function pianoNote(pitch: Pitch, options?: PianoNoteOptions): ModeledPianoNote;
