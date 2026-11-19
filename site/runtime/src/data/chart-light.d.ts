// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Group membership for the sunburst: named groups keep first-seen order; ungrouped rows share one ring. */
export function chartGroups(data: any): {
    names: any[];
    of: any;
};
/**
 * The target pose for a chart type: per-row, per-group and per-link coordinates in bent space.
 * @param {{values:number[], links:{a:number,b:number,value:number}[], groups:{names:string[],of:number[]}}} data
 */
export function chartPose(data: {
    values: number[];
    links: {
        a: number;
        b: number;
        value: number;
    }[];
    groups: {
        names: string[];
        of: number[];
    };
}, type: any, width: any, height: any): {
    type: any;
    rows: any[];
    groups: any[];
    links: {
        ua: any;
        ub: any;
        wa: any;
        wb: any;
        v: number;
        depth: number;
        alpha: number;
        trim: number;
        strands: number;
        k: number;
        ax: number;
        ay: number;
        sg: number;
    }[];
    rim: {
        span: number;
        k: number;
        ax: number;
        ay: number;
        sg: number;
    };
};
/** Morph between two poses at per-element progress; long moves around a rim lift outward so marks pass over each other. */
export function blendPose(from: any, to: any, progress: any): {
    type: any;
    rows: any;
    groups: any;
    links: any;
    rim: {
        k: number;
        ax: any;
        ay: any;
    };
};
/**
 * Per-element delays for a transition. Within one family the change sweeps around the rim; between a circle and a
 * line the elements nearest the top unroll first, so the circle peels open from its anchor.
 */
export function morphDelays(from: any, to: any, kind: any): {
    rows: any;
    groups: any;
    links: any;
    rim: number;
};
/** Light colors for a theme: dark themes add light; paper lays down ink. */
export function chartLook(theme: any): {
    additive: boolean;
    mark: any[];
    ramp: any[][];
    strand: number;
    hair: number;
    glow: number;
    ambient: boolean;
    sheen: number;
};
/**
 * Brightness of a fibre at (x, y) running along the unit tangent (tx, ty), lit from `view.light`. The highlight is
 * strongest where the fibre runs across the direction to the light, as on silk or brushed metal.
 */
export function shadeFibre(view: any, x: any, y: any, tx: any, ty: any): number;
export function heatColor(look: any, h: any, out: any): any;
/** Growable float buffers reused across frames. */
export function buffer(stride: any): {
    data: Float32Array<ArrayBuffer>;
    count: number;
    reset(): void;
    /** Make room for one more entry and return its offset. */
    slot(): number;
    push(x: any, y: any, z: any, w: any): void;
    view(): Float32Array<ArrayBuffer>;
};
/**
 * Sample the current pose into point clouds.
 * @param {object} pose blended pose
 * @param {object} view {look, width, height, ambient, spin, light:[x,y]|null, pointer:[x,y]|null,
 *   rowLight:number[], linkLight:number[], rowHeat:number[], linkHeat:number[], highlight:boolean[]}
 */
export function createSampler(): (pose: any, view: any) => {
    strands: {
        radii?: any;
        positions: any;
        colors: any;
    };
    hairs: {
        radii?: any;
        positions: any;
        colors: any;
    };
    glow: {
        radii?: any;
        positions: any;
        colors: any;
    };
    sparks: {
        radii?: any;
        positions: any;
        colors: any;
    };
    dust: {
        radii?: any;
        positions: any;
        colors: any;
    };
    pick: {
        rows: any;
        links: any;
    };
    place: (e: any, u: any, v: any) => number[];
};
export const CHART_TYPES: readonly string[];
