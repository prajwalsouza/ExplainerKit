// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A hash in [0, 1) addressed by integers, so seeded schedules need no shared random state. */
export function hash(seed: any, index: any, channel?: number): number;
/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed: any, x: any): any;
/**
 * Step response of a critically damped spring with the given half-life: 0 at the step, approaching 1.
 * Summing steps gives exact follow-through for piecewise-constant targets (gaze, head turns).
 */
export function dampedStep(age: any, halfLife: any): number;
/**
 * Seeded blink schedule. Mean interval ≈ 4 s (≈ 15 per minute, inside the measured 14–17/min mean);
 * intervals vary between 1.5 s and about 7 s. Returns lid closure in [0, 1] at time t.
 * The blink shape (fast close, short hold, slower open, ≈ 0.18 s) is an animation convention.
 */
export function blinkAt(seed: any, t: any, { mean, close, hold, open, extra }?: {
    mean?: number | undefined;
    close?: number | undefined;
    hold?: number | undefined;
    open?: number | undefined;
    extra?: never[] | undefined;
}): number;
/** Small idle eye darts: seeded targets held for 0.4–2.4 s, moving with a quick ease (placeholder timing). */
export function saccade(seed: any, t: any): any[];
/** Weight of a clip at time t: eased in over fadeIn, held, eased out over fadeOut. */
export function envelope(t: any, at: any, duration: any, fadeIn: any, fadeOut: any): number;
export function clamp(v: any, a?: number, b?: number): number;
export function lerp(a: any, b: any, t: any): any;
export function smooth(t: any): number;
export function smoothIntegral(t: any): number;
