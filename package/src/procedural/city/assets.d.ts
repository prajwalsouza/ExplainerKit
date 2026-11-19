// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function lampAsset(style: any, height?: number, seed?: number): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
    lights: {
        x: number;
        y: number;
        z: number;
    }[];
};
/**
 * One tree. `height` in metres, `crown` its widest spread. The trunk and branches are one
 * colour; leaves carry tint 1 so each placed tree can shift its green a little.
 */
export function treeAsset(form: any, spec?: {}): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
};
/** A low clipped shrub or hedge ball for planters and park edges. */
export function shrubAsset(seed?: number): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
};
/**
 * A parked car, nose toward +x. The paint is white with tint 1, so each placed car takes its
 * own colour. Head and tail lights carry glow kinds the renderer may switch on.
 */
export function carAsset(body?: string): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
    length: number;
    width: number;
};
/** A bicycle, nose toward +x, leaning on its stand. The frame carries tint 1. */
export function bikeAsset(kind?: string): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
};
/** A small open boat moored on a canal, bow toward +x. The hull carries tint 1. */
export function boatAsset(seed?: number): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
    length: number;
};
/** Street furniture by name. Unknown names are refused by the caller. */
export function furnitureAsset(kind: any, seed?: number): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
} | null;
/**
 * One clump of ground cover, modelled within about half a metre of its root. Blades and
 * leaves are foliage (they sway in the wind) and carry tint 1, so each clump can shift its
 * green; blossoms keep their own colour.
 */
export function coverAsset(kind: any, seed?: number, bloom?: number[]): {
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
};
/** What the third extra number means. The renderer switches glows by weather and time of day. */
export const surfaceKinds: Readonly<{
    plain: 0;
    lamp: 1;
    sign: 2;
    headlight: 3;
    taillight: 4;
    foliage: 5;
    glass: 6;
    signal: 7;
}>;
/**
 * Street lamps. Every style returns the mesh and `lights`: where each lamp head hangs, so the
 * renderer can add a halo and the kit can add a pool of light to the street field.
 */
export const lampStyles: readonly string[];
/** Tree forms. Each has several seeded variants; `season` changes the leaves. */
export const treeForms: readonly string[];
export const seasons: readonly string[];
export const carBodies: readonly string[];
export const furnitureKinds: readonly string[];
/** Body colours for placed cars, weighted toward the greys, whites and blacks seen on streets. */
export const CAR_PAINT: readonly number[][];
/** Colours for bicycle frames. */
export const BIKE_PAINT: readonly number[][];
/** Colours for hulls, parasols and café furniture. */
export const CLOTH_PAINT: readonly number[][];
/** Small plants that carpet the ground near trees and in parks. */
export const coverKinds: readonly string[];
/** Blossom colours for flower clumps: [hue, saturation, lightness, weight]. */
export const BLOOMS: readonly number[][];
export { personAsset, COAT_PAINT } from "./people.js";
