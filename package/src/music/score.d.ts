// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface MusicTempo {
  readonly tick: number;
  readonly microsecondsPerQuarter: number;
}
export interface MusicMeterInput {
  readonly tick: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly clocks?: number;
  readonly thirtySeconds?: number;
}
export type MusicMeter = Required<MusicMeterInput>;
export interface MusicNoteInput {
  readonly id?: string;
  readonly tick: number;
  readonly duration: number;
  readonly pitch: number;
  readonly velocity?: number;
  readonly releaseVelocity?: number;
  readonly channel?: number;
}
export type MusicNote = Required<MusicNoteInput>;
export interface MusicChannelMessage {
  readonly tick: number;
  readonly status: number;
  readonly data1: number;
  readonly data2?: number;
}
export interface MusicTrackInput {
  readonly id?: string;
  readonly name?: string;
  readonly notes?: readonly MusicNoteInput[];
  readonly messages?: readonly MusicChannelMessage[];
  readonly endTick?: number;
}
export interface MusicTrack {
  readonly id: string;
  readonly name: string;
  readonly notes: readonly MusicNote[];
  readonly messages: readonly MusicChannelMessage[];
  readonly endTick: number;
}
export interface MusicScoreInput {
  readonly version?: 1;
  readonly title?: string;
  readonly ppq?: number;
  readonly endTick?: number;
  readonly tempos?: readonly MusicTempo[];
  readonly meters?: readonly MusicMeterInput[];
  readonly tracks?: readonly MusicTrackInput[];
}
export interface MusicScore {
  readonly version: 1;
  readonly title: string;
  readonly ppq: number;
  readonly endTick: number;
  readonly tempos: readonly MusicTempo[];
  readonly meters: readonly MusicMeter[];
  readonly tracks: readonly MusicTrack[];
}
export interface MusicScoreTime {
  readonly duration: number;
  secondsAt(tick: number): number;
  tickAt(seconds: number): number;
}
export const SCORE_LIMITS: Readonly<{ tracks: 128; events: 100000; tick: 268435455 }>;
export function createMusicScore(input?: MusicScoreInput): MusicScore;
export function musicScoreTime(input: MusicScoreInput): MusicScoreTime;
