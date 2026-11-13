// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { Scene } from '../core/scene.js';
export interface ProjectionHost {
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
  matchMedia?(query: string): MediaQueryList;
  performance?: Pick<Performance, 'now'>;
}
export interface ProjectionContext {
  readonly time: number;
  readonly ambient: number;
  readonly view: ReturnType<Scene['sampleView']>['view'];
}
export interface ProjectionOptions {
  host?: ProjectionHost;
  project(frame: ReturnType<Scene['sample']>, context: ProjectionContext): void;
  reducedMotion?: boolean;
}
export interface ProjectionCost {
  readonly sampleMS: number;
  readonly projectMS: number;
  readonly totalMS: number;
}
export interface ProjectionPlayer {
  readonly time: number;
  readonly duration: number;
  readonly playing: boolean;
  readonly disposed: boolean;
  readonly reducedMotion: boolean;
  readonly frame: ReturnType<Scene['sample']> | null;
  readonly view: ReturnType<Scene['sampleView']>['view'] | null;
  readonly error: unknown;
  readonly cost: ProjectionCost | null;
  readonly driver: 'scroll' | 'media' | null;
  speed: number;
  on(name: string, listener: (value: any) => void): () => void;
  reportError(error: unknown): void;
  setDriver(driver: 'scroll' | 'media' | null): this;
  syncTime(seconds: number, options?: {source?: 'media'; playing?: boolean}): this;
  seek(seconds: number, options?: {reset?: boolean; source?: 'manual' | 'scroll' | 'media'}): this;
  play(): this;
  pause(): this;
  refresh(): {frame: ReturnType<Scene['sample']>; view: ReturnType<Scene['sampleView']>['view']; ambient: number; cost: ProjectionCost};
  profile(): ReturnType<Scene['profile']>;
  dispose(): void;
}
/** Native scene sampling with application-owned projection and library-owned clock. */
export function createProjectionPlayer(scene: Scene, options: ProjectionOptions): ProjectionPlayer;
