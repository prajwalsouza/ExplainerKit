// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {MusicGrid} from './grid.js';
import type {MusicPCMInput} from './input.js';
export type AdaptiveQuantize = 'immediate' | 'beat' | 'bar' | 'clip-end' | 'exit-cue' | {bars: number};
export type PlaylistItem = string | {clip: string; repeat?: number} | {sequence: readonly PlaylistItem[]; repeat?: number} | {choose: readonly PlaylistItem[]; repeat?: number} | {loop: readonly PlaylistItem[]};
export interface AdaptiveClip {bars?: number; beats?: number; pickup?: number; tail?: number; exitCues?: readonly number[];}
export interface AdaptiveScoreOptions {
  tempo: number; beatsPerBar?: number; seed?: string | number; initial?: string; layerFade?: number;
  clips: Readonly<Record<string, AdaptiveClip>>;
  states: Readonly<Record<string, {play: readonly PlaylistItem[]; next?: string}>>;
  layers?: Readonly<Record<string, {from?: number; to?: number}>>;
  transitions?: readonly {from?: string; to?: string; at?: AdaptiveQuantize; via?: string; fade?: number; match?: boolean}[];
  stingers?: Readonly<Record<string, {beats?: number; pickup?: number; at?: Exclude<AdaptiveQuantize, 'clip-end' | 'exit-cue'>}>>;
}
export type AdaptiveChange = {at: number; state: string; intensity?: never; stinger?: never} | {at: number; intensity: number; state?: never; stinger?: never} | {at: number; stinger: string; state?: never; intensity?: never};
export interface ScheduledClip {readonly clip: string; readonly state: string; readonly start: number; readonly offset: number; readonly from: number; readonly end: number; readonly fadeIn: number; readonly fadeOut: number; readonly cut: boolean; readonly tail: number; readonly pickup: number;}
export interface AdaptiveMarker {readonly time: number; readonly type: 'state' | 'clip' | 'transition' | 'intensity' | 'stinger'; readonly [key: string]: unknown;}
export interface AdaptivePlan {readonly duration: number; readonly tempo: number; readonly beatsPerBar: number; readonly clips: readonly ScheduledClip[]; readonly layers: Readonly<Record<string, readonly {readonly time: number; readonly gain: number}[]>>; readonly stingers: readonly {readonly stinger: string; readonly hit: number; readonly start: number; readonly end: number}[]; readonly markers: readonly AdaptiveMarker[];}
export type AdaptiveSources = Readonly<Record<string, MusicPCMInput | Readonly<Record<string, MusicPCMInput>>>>;
export interface AdaptiveScore {
  readonly tempo: number; readonly beatsPerBar: number; readonly clips: readonly string[]; readonly states: readonly string[]; readonly layers: readonly string[]; readonly stingers: readonly string[];
  plan(changes?: readonly AdaptiveChange[], options?: {duration: number; intensity?: number}): AdaptivePlan;
  sample(plan: AdaptivePlan, time: number): {readonly state: string | null; readonly clip: string | null; readonly clipTime: number | null; readonly layers: Readonly<Record<string, number>>};
  render(plan: AdaptivePlan, sources: AdaptiveSources, options?: {sampleRate?: number; from?: number; duration?: number}): {readonly channels: readonly Float32Array[]; readonly sampleRate: number; readonly duration: number; readonly clippedSamples: number};
  grid(plan: AdaptivePlan): MusicGrid;
}
export declare function createAdaptiveScore(options: AdaptiveScoreOptions): AdaptiveScore;
