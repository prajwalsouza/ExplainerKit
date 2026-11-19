// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Decide how one building looks. Pure and deterministic: the same building, palette and seed
 * give the same answer. Values that the map did not supply are listed in `inferred`.
 */
export function buildingStyle(b: any, spec?: {}): {
    id: any;
    kind: any;
    recent: boolean;
    material: any;
    window: number;
    ground: number;
    bay: number;
    wall: string;
    wallHSL: Readonly<{
        h: number;
        s: any;
        l: any;
        a: any;
    }> | {
        h: any;
        s: number;
        l: number;
    };
    trim: string;
    door: string;
    roof: string;
    roofMaterial: number;
    balcony: number;
    shutters: boolean;
    awnings: any;
    chimneys: any;
    cornice: boolean;
    course: boolean;
    plinth: boolean;
    seed: number;
    inferred: string[];
    r: (k: any) => number;
};
/** How many bays fit a wall, and how wide each is. A wall too short for a window has none. */
export function bayLayout(length: any, target: any): {
    margin: number;
    count: number;
    width: number;
};
/**
 * Add one building to the wall, roof and trim meshes. `party(edgeIndex, ring)` says whether a
 * wall is shared with a neighbour, which gets no windows or trim. Returns the style used.
 */
export function addBuilding(b: any, layers: any, spec: any, party: any): {
    id: any;
    kind: any;
    recent: boolean;
    material: any;
    window: number;
    ground: number;
    bay: number;
    wall: string;
    wallHSL: Readonly<{
        h: number;
        s: any;
        l: any;
        a: any;
    }> | {
        h: any;
        s: number;
        l: number;
    };
    trim: string;
    door: string;
    roof: string;
    roofMaterial: number;
    balcony: number;
    shutters: boolean;
    awnings: any;
    chimneys: any;
    cornice: boolean;
    course: boolean;
    plinth: boolean;
    seed: number;
    inferred: string[];
    r: (k: any) => number;
};
/** Wall materials, in the order the renderer's facade shader numbers them. */
export const wallMaterials: readonly string[];
/** Window styles, in the order the facade shader numbers them. */
export const windowStyles: readonly string[];
/** Ground-floor styles, in the order the facade shader numbers them. */
export const groundStyles: readonly string[];
/** Roof surface materials, in the order the roof shader numbers them. */
export const roofMaterials: readonly string[];
export const cityPalettes: readonly string[];
