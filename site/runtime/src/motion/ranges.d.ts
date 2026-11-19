// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * 0 before `from`, 1 after `to`, and a smooth S-curve (smoothstep) between. Reversed bounds
 * give a falling ramp. Use it to fade something in across a stretch of scroll.
 */
export function smoothWindow(from: any, to: any, value: any): number;
/** Linear map of `value` from [a0, a1] to [b0, b1], clamped to the output range unless `clamp` is false. */
export function remap(value: any, a0: any, a1: any, b0: any, b1: any, clamp?: boolean): any;
/**
 * Rise, hold and fall: 0 before `start`, rising over `rise` to 1, holding until `end`, then
 * falling to 0 over `fall`. Each edge is a smoothstep.
 */
export function envelope(value: any, start: any, end: any, rise?: number, fall?: number): number;
/**
 * Interpolate keyed values: keys are [[at, value], ...] in increasing order of `at`. Values
 * hold before the first key and after the last. `ease` (default smoothstep) shapes each span;
 * pass 'linear' for straight segments.
 */
export function keyed(value: any, keys: any, ease?: string): any;
