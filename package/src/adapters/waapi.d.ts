// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Native HTML/SVG CSS effects. All authored times use seconds. */
export interface WAAPIKeyframe {
  transform?: string;
  opacity?: number;
  offset?: number;
  /** Native CSS easing keyword, cubic-bezier(...) or bounded steps(...). */
  easing?: string;
}
export interface WAAPIPlayer {
  readonly time: number;
  readonly disposed?: boolean;
  on(event: 'frame', callback: (event: {time: number}) => void): () => void;
  on(event: 'dispose', callback: () => void): () => void;
  seek(time: number): unknown;
  play(): unknown;
  pause(): unknown;
  reportError?(error: unknown): unknown;
}
export interface WAAPIOptions {
  /** Seconds per iteration. Default 1; zero is an instantaneous final pose. */
  duration?: number;
  /** Start delay in seconds. Default 0. */
  at?: number;
  /** Additional whole iterations, 0–1000. Total end must not exceed 86400 seconds. */
  repeat?: number;
  easing?: string;
  /** Explicit opt-in; defaults false. Respects reduced motion. */
  autoplay?: boolean;
  /** Keeps native effects paused and follows player frame events. */
  player?: WAAPIPlayer;
  /** Default respect pins the final pose when reduced motion is requested. */
  reducedMotion?: 'respect' | 'allow';
  onError?: (error: unknown) => void;
}
export interface WAAPIController {
  play(): WAAPIController;
  pause(): WAAPIController;
  /** With a player, delegates to player.seek; otherwise samples the native effect. */
  seek(time: number): WAAPIController;
  /** Samples the final pose without starting playback. */
  finish(): WAAPIController;
  dispose(): void;
  readonly disposed: boolean;
  readonly time: number;
  readonly duration: number;
  readonly end: number;
  readonly reducedMotion: boolean;
  readonly error: unknown;
  readonly playState: AnimationPlayState;
}
export declare function animateWAAPI(targets: Element | readonly Element[], keyframes: readonly WAAPIKeyframe[], spec?: WAAPIOptions): WAAPIController;
export declare const waapi: Readonly<{animate: typeof animateWAAPI}>;
