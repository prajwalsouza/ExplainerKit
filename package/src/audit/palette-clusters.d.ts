// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Histogram keys describe composited 8-bit sRGB, not arbitrary CSS strings. */
export function addRGB(histogram: any, rgb: any, alpha: any, background: any): void;
/** Deterministic farthest-point seeds, then eight weighted Lloyd updates in OKLab. */
export function clusterPalette(histogram: any, maxColors: any, background: any): {
    color: string;
    oklab: number[];
    count: number;
    coverage: number;
    chroma: number;
    hue: number | null;
    contrast: number;
}[];
export function paletteDrift(first: any, second: any): number | null;
export function labDistanceSquared(a: any, b: any): number;
