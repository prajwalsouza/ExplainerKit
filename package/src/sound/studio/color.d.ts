// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Harmonic saturation. Without an `output` level the result is matched to the
 * input's RMS level, so a comparison hears the colour and not a volume change.
 */
export function saturation(buffer: any, params: any): void;
/** Reduce bit depth and hold samples, for deliberately coarse digital texture. */
export function bitcrush(buffer: any, params: any): void;
/** Add harmonics generated from the upper band only, which brightens without raising the whole top end. */
export function exciter(buffer: any, params: any): void;
/** Mid/side width. `lowMono` keeps frequencies below it in the centre. */
export function width(buffer: any, params: any): void;
/** Equal-power balance, scaled so the centre position leaves the level unchanged. */
export function pan(buffer: any, params: any): void;
/** Delay one side by a few milliseconds, which moves a sound sideways without changing its level. */
export function haas(buffer: any, params: any): void;
/** Gain in decibels, as one value or as automation points. */
export function gain(buffer: any, params: any): void;
/** Fade the start and the end of the buffer with raised-cosine ramps. */
export function fade(buffer: any, params: any): void;
export const SATURATION_CURVES: readonly string[];
