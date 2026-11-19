// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Bounded constructive placement. Every returned measured box fits and avoids all prior boxes. */
export function placeLabels(input: any, spec: any): readonly (Readonly<{
    id: any;
    text: any;
    x: any;
    y: any;
    width: any;
    height: any;
}> | undefined)[];
/** Caller owns the context and font loading. A fixed lineHeight bounds a single unwrapped line. */
export function canvasTextMeasurer(context: any, spec: any): (value: any) => {
    width: any;
    height: any;
};
/**
 * Place names around a circle, following the rules of a well-set radial chart.
 *
 * A rim label belongs to a mark that covers `span` radians. When that arc is at least `wideArc` wide, or the name
 * fits along it, the name stands upright just outside the rim, aligned away from the centre. A narrower mark gets
 * its name along the radius, like a spoke, so neighbours stack side by side instead of on top of each other.
 * Neighbours that would still collide slide apart around the rim by at most `maxShift` radians, spokes keep at
 * least `spokeGap` radians apart, and whatever still collides gives way to the neighbour with the higher
 * `priority`. The `keep` ID is never hidden.
 *
 * A label with a `band` ({r0, r1}) is set inside its own mark instead: along the radius at the band's middle, as a
 * box as long as the band (86%) that wraps to two lines when the arc is wide enough, and hidden when the arc cannot
 * hold one line. Give the mark's `fill` and the label returns `ink`, the `light` or `dark` text colour with the
 * higher contrast against it.
 *
 * Work is bounded: at most 256 labels, 40 relaxation passes and one hiding pass per label.
 * @param {ReadonlyArray<{id: string, text: string, angle: number, span?: number, priority?: number, r?: number,
 *          band?: {r0: number, r1: number}, fill?: string}>} input
 * @param {{cx: number, cy: number, r: number, measure: (text: string) => {width: number, height: number},
 *          gap?: number, maxShift?: number, wideArc?: number, spokeGap?: number, keep?: string | null,
 *          light?: string, dark?: string}} spec
 */
export function placeRadialLabels(input: ReadonlyArray<{
    id: string;
    text: string;
    angle: number;
    span?: number;
    priority?: number;
    r?: number;
    band?: {
        r0: number;
        r1: number;
    };
    fill?: string;
}>, spec: {
    cx: number;
    cy: number;
    r: number;
    measure: (text: string) => {
        width: number;
        height: number;
    };
    gap?: number;
    maxShift?: number;
    wideArc?: number;
    spokeGap?: number;
    keep?: string | null;
    light?: string;
    dark?: string;
}): any;
