// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A deterministic size-on-screen selector; thresholds and fades are CSS pixels. */
export function detailLevels(input: any, spec?: {}): Readonly<{
    levels: readonly Readonly<{
        below: any;
        draw: any;
    }>[];
    fade: any;
    sample(extent: any): Readonly<{
        extent: any;
        selected: number;
        weights: readonly number[];
    }>;
}>;
/** Compile each detail drawing once; bind only wrapper opacity during sampling. */
export function detail(scene: any, spec?: {}): any;
