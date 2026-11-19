// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A vehicle shape varied along several dimensions at once. `size` scales the vehicle (0.8 is a
 * small one of its kind, 1.25 a large one); `era` is 'classic' (square, upright glass, more of
 * it), 'modern' or 'sleek' (low, rounded, raked glass); `ride` raises or lowers the body on its
 * wheels in metres (-0.05 to 0.15). Returns a plain shape for vehicleAsset's `shape` option.
 */
export function vehicleShape(kind: any, spec?: {}): any;
/**
 * Build one vehicle. `kind` names a built-in shape, and `shape` overrides any of its numbers.
 * `running` says whether its lights can be switched on. For trams, `end` is 'front', 'middle'
 * or 'rear', which shapes the ends of a section and adds a pantograph to the middle one.
 * Returns {mesh, shape}.
 */
export function vehicleAsset(kind?: string, spec?: {}): {
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
    shape: any;
};
/**
 * The look of variant `variant` of a vehicle type in a place: an era chosen by the regional
 * style, a size and a ride height. The same type, variant, seed and style always give the
 * same look, which is what lets every car sharing that look share one model.
 */
export function vehicleLook(kind: any, variant: any, seed?: number, style?: null): {
    era?: undefined;
    size?: undefined;
    ride?: undefined;
} | {
    era: string;
    size: number;
    ride: number;
};
/** Surface kinds this module adds to those in assets.js. */
export const vehicleSurfaceKinds: Readonly<{
    wheel: 0.4;
    headlight: 3;
    taillight: 4;
}>;
/**
 * The built-in shapes, in metres. `length` and `width` are overall; `hood` is the height of
 * the bonnet or front deck, `belt` the height where the glass starts and `roof` the top.
 * `cabin` is where the glass starts and ends along the vehicle (from its middle), `rake` how
 * far the rear and front glass lean in, `wheel` the wheel radius and `axles` where they sit.
 * `nose` and `tail` round the ends in plan (0 square, 1 very round). `tumble` leans the sides
 * in toward the roof. `doors` and `band` only apply to buses and trams.
 */
export const VEHICLE_SHAPES: any;
export const vehicleKinds: readonly string[];
/** Vehicles grouped by what they are for, so a scene can ask for a whole group. */
export const vehicleFamilies: Readonly<{
    cars: readonly string[];
    work: readonly string[];
    transit: readonly string[];
    cycles: readonly string[];
}>;
/** Eras of design: how square or rounded a body is, and how its glass rakes. */
export const vehicleEras: readonly string[];
/** Looks drawn for each vehicle type, so a street has variety without a model per car. */
export const VEHICLE_VARIANTS: 3;
