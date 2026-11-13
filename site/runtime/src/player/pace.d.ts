// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type ScrollPaceName = 'still' | 'reading' | 'skimming' | 'rushing';
export type ArrivalMode = 'jump' | 'travel' | 'chapter' | 'top';
export interface ScrollPaceSample {
  readonly position: number;
  /** Pixels per second, signed: positive scrolls down the story. */
  readonly velocity: number;
  /** Viewport heights per second. */
  readonly speed: number;
  readonly direction: -1 | 0 | 1;
  readonly pace: ScrollPaceName;
}
export interface ScrollPace {
  add(position: number, time: number): ScrollPaceSample;
  sample(time: number): ScrollPaceSample;
  resize(viewportHeight: number): void;
  reset(): void;
}
export interface ScrollPaceOptions {
  viewportHeight?: number;
  /** Milliseconds of samples the velocity spans (default 180). */
  window?: number;
  /** Upper speeds of still, reading and skimming, in viewport heights per second. */
  bounds?: readonly [number, number, number];
}
export interface ArrivalPlan {
  readonly mode: ArrivalMode;
  readonly from: number;
  readonly to: number;
  readonly seconds: number;
  readonly rewind: boolean;
}
export interface ArrivalState extends ArrivalPlan {
  readonly waiting: boolean;
  readonly done: boolean;
}
export interface ArrivalOptions {
  /** How a story opened part-way comes in. Default `jump`. */
  arrival?: ArrivalMode;
  arrivalSeconds?: number;
  /** Longest wait for `ready`, in milliseconds (default 4000). */
  arrivalWait?: number;
  /** Resolve when the act can play; the replay holds at its start until then. */
  ready?: (act: string | null) => unknown;
  onArrival?: (plan: ArrivalState) => void;
  /** Called when the pace class or direction changes. */
  onPace?: (pace: ScrollPaceSample) => void;
  paceBounds?: readonly [number, number, number];
}
export const SCROLL_PACES: readonly ScrollPaceName[];
export const DEFAULT_PACE_BOUNDS: readonly [number, number, number];
export const ARRIVALS: readonly ArrivalMode[];
export function scrollPace(spec?: ScrollPaceOptions): ScrollPace;
export function arrivalPlan(spec: {
  mode?: ArrivalMode;
  time: number;
  duration: number;
  chapters?: readonly number[];
  seconds?: number | null;
}): ArrivalPlan;
export function arrivalTime(plan: ArrivalPlan, elapsed: number, to?: number): number;
/** @internal Shared by the scroll drivers. */
export function arrivalController(spec: Record<string, unknown>): {
  readonly state: ArrivalState | null;
  readonly active: boolean;
  touch(): void;
  offer(position: number, viewport: number, makePlan: (mode: ArrivalMode, seconds: number | null) => ArrivalPlan, act: string | null): ArrivalPlan | null;
  timeFor(target: number): number | null;
};
