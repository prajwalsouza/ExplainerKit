// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {Timeline, TimelineSnapshot, TimelineValuesSnapshot, TimelineEvent} from '../motion/timeline.js';
import type {ProjectionHost} from './projection.js';
export interface TimelinePlayerContext {
  readonly time: number;
  readonly previousTime: number;
  readonly backwards: boolean;
  readonly kind: string;
}
interface TimelinePlayerBaseOptions {
  host?: ProjectionHost;
  onEvent?(event: TimelineEvent, context: TimelinePlayerContext): void;
  reducedMotion?: boolean;
  horizon?: number;
  maxEvents?: number;
}
export type TimelinePlayerOptions = TimelinePlayerBaseOptions & (
  {project(snapshot: TimelineSnapshot, context: TimelinePlayerContext): void; projectValues?: never} |
  {projectValues(snapshot: TimelineValuesSnapshot, context: TimelinePlayerContext): void; project?: never}
);
export interface TimelinePlayer {
  readonly time: number;
  readonly duration: number;
  readonly progress: number;
  readonly iterationTime: number;
  readonly iteration: number;
  readonly backwards: boolean;
  readonly completed: boolean;
  readonly playing: boolean;
  readonly disposed: boolean;
  readonly reducedMotion: boolean;
  readonly frame: TimelineSnapshot | null;
  readonly error: unknown;
  readonly driver: 'scroll' | 'media' | null;
  speed: number;
  on(name: 'frame', listener: (value: {time: number; frame: TimelineSnapshot}) => void): () => void;
  on(name: string, listener: (value: any) => void): () => void;
  reportError(cause: unknown): void;
  setDriver(driver: 'scroll' | 'media' | null): this;
  seek(seconds: number, options?: {mute?: boolean; reset?: boolean; source?: 'manual'|'scroll'|'media'}): this;
  syncTime(seconds: number, options?: {source?: 'media'; playing?: boolean; mute?: boolean}): this;
  play(): this;
  pause(): this;
  restart(options?: {mute?: boolean; play?: boolean}): this;
  refresh(): {frame: TimelineSnapshot};
  dispose(): void;
}
export function createTimelinePlayer(timeline: Timeline, options: TimelinePlayerOptions): TimelinePlayer;
