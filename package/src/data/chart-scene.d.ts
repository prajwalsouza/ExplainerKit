// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * The live light-strand chart. Rows become hair bundles and links become silk strands; every chart type is one pose
 * of the same elements, so type changes and data updates morph instead of cross-fading.
 * @param {{data:any[], connections:any[]}} model
 * @param {{label?:string, motion:boolean, theme:any, type:string, clock?:{now:()=>number, live:()=>boolean}}} spec
 */
export function chartScene(model: {
    data: any[];
    connections: any[];
}, { label, motion, theme, type, clock }: {
    label?: string;
    motion: boolean;
    theme: any;
    type: string;
    clock?: {
        now: () => number;
        live: () => boolean;
    };
}): {
    drawing: import("../core/scene.js").Scene;
    readonly width: number;
    readonly height: number;
    links: any[];
    setView(nextType: any, nextTheme: any): void;
    /** Replace values: rows by ID and links by endpoint pair. Rising values flare with heat, then cool. */
    setData(next: any): void;
    setSelection(nextHover: any, nextFocus: any): void;
    /** Pointer in scene units, or null when it leaves: it lights the silk and draws nearby hairs toward it. */
    setPointer(point: any): void;
    setAmbientPaused(paused: any): void;
    /** True when the current layout is a circle that a drag can turn. */
    readonly spins: boolean;
    readonly centre: number[];
    beginSpin(): void;
    turn(delta: any): void;
    endSpin(velocity: any): void;
    /** The row or link under a point in scene units. */
    pick(x: any, y: any): null;
};
export const chartTypes: readonly string[];
