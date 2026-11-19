// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Create a variation source. `seed` picks the family of values; `preset` names a style of
 * variation; `amount` scales every default spread (0 gives identical copies).
 */
export function variation(spec?: {}): Readonly<{
    seed: number;
    preset: any;
    amount: number;
    /** A uniform number in [0, 1). Prefer the shaped helpers for visible attributes. */
    random(i: any, s?: {}): number;
    /** A standard normal value clipped to +-clip (default 3). */
    normal(i: any, s?: {}): number;
    /** Bounded normal around `center` with standard deviation `spread` in the value's units. */
    around(i: any, center: any, s?: {}): any;
    /** Log-normal size around `typical`: positive, skewed toward a few larger items. */
    size(i: any, typical: any, s?: {}): number;
    /** A direction near `base` radians, wrapped to (-pi, pi]. */
    angle(i: any, base?: number, s?: {}): number;
    /** A value in [low, high]; `shape:'bell'` (default) favours the middle, 'uniform' does not. */
    between(i: any, low: any, high: any, s?: {}): any;
    /** Weighted choice: pick(i, {ivory: 6, sage: 3, charcoal: 1}) returns one key. */
    pick(i: any, weights: any, s?: {}): string;
    /** True with probability `p`. */
    chance(i: any, p: any, s?: {}): boolean;
    /** True for roughly `rate` of items (the preset's rate by default): a missing filament, a gap. */
    dropout(i: any, rate: any, s?: {}): boolean;
    /** Mostly a small offset; for about `rate` of items a larger one. Offsets are in the base's units. */
    misalign(i: any, base: any, s?: {}): any;
    /**
     * Several attributes from one hidden character, so they agree. `ranges` maps names to
     * [low, high]; `correlate` lists [a, b, r] pairs with r in (-1, 1). Each trait is spread
     * evenly over its range and pairs reach the requested rank correlation.
     */
    traits(i: any, ranges: any, s?: {}): Readonly<{}>;
    /** A small bounded HSLA wobble around a swatch. Deltas are the largest change in degrees and percent. */
    tint(i: any, color: any, s?: {}): string;
    /** A tint that varies smoothly in space: neighbours within about `scale` units look alike. */
    tintAt(point: any, color: any, s?: {}): string;
    /** Coherent drift over time in [-amount, amount]: a flutter that wanders rather than jumps. */
    flutter(i: any, time: any, s?: {}): number;
    /** A start time with a small bounded offset, so a sequence feels played rather than quantised. */
    humanize(i: any, time: any, s?: {}): any;
    /**
     * Clustered placement in a rectangle: `count` points around `clusters` centres, kept at least
     * `minDistance` apart where possible. Work is bounded by `attempts` per point.
     */
    cluster(s?: {}): Readonly<{
        points: readonly Readonly<{
            x: number;
            y: number;
            cluster: number;
        }>[];
        centres: readonly Readonly<{
            x: any;
            y: any;
        }>[];
        crowded: number;
    }>;
}>;
/**
 * Report repeated things that look machine-made. Give `numbers` (sizes, angles, times),
 * `points` ({x, y}) or `colors`. Findings name robotic uniformity, even spacing, grid-like
 * placement, identical colours and outliers. It never changes the input.
 */
export function auditVariation(input?: {}): Readonly<{
    ok: boolean;
    findings: readonly Readonly<unknown>[];
    stats: Readonly<{
        coefficientOfVariation: number;
        outliers: any;
        nearestNeighbourVariation: number;
        distinctColors: number;
    }>;
}>;
export const variationPresets: readonly string[];
