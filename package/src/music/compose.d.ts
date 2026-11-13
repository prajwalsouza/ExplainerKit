// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { MusicScore } from './score.js';
import type { Pitch } from '../sound/instruments.js';

/** Chord qualities understood by `chordPitches`, as semitones above the root. */
export declare const CHORD_SHAPES: Readonly<Record<string, readonly number[]>>;
export declare function chordPitches(symbol: string, options?: { readonly octave?: number; readonly inversion?: number }): number[];
export interface VoiceLeadOptions {
  readonly voices?: number;
  readonly low?: Pitch;
  readonly high?: Pitch;
  readonly top?: Pitch;
}
export declare function voiceLead(chords: readonly string[], options?: VoiceLeadOptions): number[][];

export interface ArpeggioOptions {
  readonly pattern?: 'up' | 'down' | 'updown' | readonly number[];
  readonly steps?: number;
  readonly step?: number;
  readonly length?: number;
  readonly velocity?: number;
  readonly accent?: number;
  readonly every?: number;
}
export interface ArpeggioNote {
  beat: number;
  pitch: number;
  beats: number;
  velocity: number;
}
export declare function arpeggiate(pitches: readonly Pitch[], options?: ArpeggioOptions): ArpeggioNote[];

/** A note placed by bar and beat, both counted from zero. A pitch list writes a chord. */
export interface ArrangedNote {
  readonly bar: number;
  readonly beat?: number;
  readonly pitch: Pitch | readonly Pitch[];
  readonly beats?: number;
  readonly velocity?: number;
}
export interface ArrangementPart {
  readonly id: string;
  readonly name?: string;
  readonly notes: readonly ArrangedNote[];
  readonly expression?: readonly { readonly bar: number; readonly beat?: number; readonly value: number }[];
  readonly pedal?: 'bar' | readonly { readonly bar: number; readonly beat?: number }[];
  readonly program?: number;
  readonly percussion?: boolean;
}
export interface ArrangementTempo {
  readonly bar: number;
  readonly beat?: number;
  readonly bpm: number;
  readonly ramp?: boolean;
}
export interface Arrangement {
  readonly title?: string;
  readonly ppq?: number;
  readonly tempo?: number | readonly ArrangementTempo[];
  readonly meter?: readonly [beats: number, unit: 1 | 2 | 4 | 8 | 16];
  readonly bars: number;
  readonly parts: readonly ArrangementPart[];
}
export declare function arrangeMusic(arrangement: Arrangement): MusicScore;
