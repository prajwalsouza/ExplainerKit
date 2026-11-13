// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { MusicScoreInput } from './score.js';
import type { AudioMeters, AutomationPoint, EffectReport, StudioEffect, StudioInstrument } from '../sound/studio/index.js';

/** An automation point placed by score tick or by seconds. */
export type ProductionPoint = { readonly tick: number; readonly value: number } | AutomationPoint;
/**
 * A studio effect whose automated values may also be written as `{tick, value}`
 * points. Tick points are converted to seconds through the score's tempo map.
 */
export type ProductionEffect = StudioEffect | (Omit<StudioEffect, 'frequency' | 'gain' | 'pan' | 'width'> & { readonly [key: string]: unknown });

export interface ProductionTrack {
  readonly id: string;
  readonly instrument: StudioInstrument;
  readonly gain?: number;
  readonly pan?: number;
  readonly output?: string;
  readonly effects?: readonly ProductionEffect[];
  readonly sends?: Readonly<Record<string, number>>;
  readonly humanize?: { readonly timing?: number; readonly velocity?: number };
  readonly automation?: { readonly gain?: readonly ProductionPoint[]; readonly pan?: readonly ProductionPoint[] };
  readonly mute?: boolean;
  readonly transpose?: number;
}
export interface ProductionBus {
  readonly id: string;
  readonly effects?: readonly ProductionEffect[];
  readonly gain?: number;
  readonly pan?: number;
  readonly sends?: Readonly<Record<string, number>>;
  readonly output?: string;
}
export interface ProductionReturn {
  readonly id: string;
  readonly effects?: readonly ProductionEffect[];
  readonly gain?: number;
}
export interface ProductionMaster {
  readonly effects?: readonly ProductionEffect[];
  readonly gain?: number;
  /** Integrated loudness target in LUFS. Leave it out to keep the mix level. */
  readonly loudness?: number;
  /** True-peak ceiling in dBTP. `null` turns the final limiter off. */
  readonly ceiling?: number | null;
}
export interface MusicProductionOptions {
  readonly sampleRate?: number;
  readonly tail?: number | 'auto';
  readonly seed?: number | string;
  readonly tracks?: readonly ProductionTrack[];
  readonly buses?: readonly ProductionBus[];
  readonly returns?: readonly ProductionReturn[];
  readonly master?: ProductionMaster;
  readonly stems?: false | 'tracks' | 'buses';
}
export interface MusicProductionStem {
  readonly id: string;
  readonly kind: 'track' | 'bus' | 'return';
  readonly channels: readonly [Float32Array, Float32Array];
}
export interface MusicProduction {
  readonly sampleRate: number;
  readonly channels: readonly [Float32Array, Float32Array];
  readonly duration: number;
  readonly scoreDuration: number;
  readonly loudness: number;
  readonly truePeak: number;
  readonly peak: number;
  readonly clippedSamples: number;
  readonly meters: AudioMeters;
  readonly normalization: number;
  readonly tracks: readonly Readonly<{ id: string; instrument: string; voices: number; peak: number }>[];
  readonly stems: readonly MusicProductionStem[];
  readonly reports: Readonly<{
    tracks: Readonly<Record<string, readonly EffectReport[]>>;
    buses: Readonly<Record<string, readonly EffectReport[]>>;
    returns: Readonly<Record<string, readonly EffectReport[]>>;
    master: readonly EffectReport[];
  }>;
  readonly work: number;
}
export declare const PRODUCTION_LIMITS: Readonly<{ seconds: number; tracks: number; buses: number; returns: number; work: number }>;
export declare function produceMusic(score: MusicScoreInput, production?: MusicProductionOptions): MusicProduction;
