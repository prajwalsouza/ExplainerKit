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
