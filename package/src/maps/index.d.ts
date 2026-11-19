// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A local projection for a region: longitude and latitude in degrees to metres east and north of
 * `center`. It is equirectangular, scaled by the cosine of the central latitude, which is accurate
 * enough at regional scale (a few hundred kilometres) but not for continents.
 */
export function localProjection(spec?: {}): Readonly<{
    center: Readonly<{
        lon: any;
        lat: any;
    }>;
    project(lon: any, lat: any): Readonly<{
        x: number;
        y: number;
    }>;
    unproject(x: any, y: any): Readonly<{
        lon: any;
        lat: any;
    }>;
}>;
/**
 * A validated grid of elevations in metres. `columns` x `rows` samples cover `bounds`
 * ({x0, y0, x1, y1} in region metres, y increasing north); row 0 is the north edge. Values can be
 * a plain array or a typed array; `noData` samples are refused rather than guessed.
 */
export function heightfield(spec?: {}): Readonly<{
    columns: any;
    rows: any;
    bounds: Readonly<{
        x0: any;
        y0: any;
        x1: any;
        y1: any;
    }>;
    spacing: Readonly<{
        x: number;
        y: number;
    }>;
    min: number;
    max: number;
    seaLevel: any;
    /** The raw samples, row 0 first. A copy, so the field stays immutable. */
    values: () => Float64Array<ArrayBuffer>;
    /** Elevation at grid sample (i, j), clamped to the edge. */
    at(i: any, j: any): number;
    /** Bilinear elevation at a region point in metres, clamped to the edge. */
    sample(x: any, y: any): number;
    /** Region coordinates of grid sample (i, j). */
    position(i: any, j: any): Readonly<{
        x: any;
        y: number;
    }>;
    /** Unit surface normal at a region point, with heights multiplied by `exaggeration`. z is up. */
    normal(x: any, y: any, exaggeration?: number): Readonly<{
        x: number;
        y: number;
        z: number;
    }>;
    /** Slope at a point in degrees. */
    slope(x: any, y: any, exaggeration?: number): number;
}>;
/**
 * Lambert shading of the relief for a sun at `azimuth` degrees clockwise from north and
 * `altitude` degrees above the horizon. Returns brightness per sample in [0, 1], row 0 first.
 */
export function hillshade(f: any, spec?: {}): Float32Array<ArrayBuffer>;
/**
 * Water flow over the terrain. Depressions are filled first (priority flood, Barnes et al. 2014),
 * so every land cell drains to the edge or the sea. Returns, per sample, the downstream neighbour
 * (-1 at an outlet), the filled surface and the accumulation (how many samples drain through it).
 */
export function flow(f: any, spec?: {}): Readonly<{
    columns: any;
    rows: any;
    downstream: Int32Array<ArrayBuffer>;
    filled: any;
    accumulation: Float64Array<ArrayBuffer>;
    seaLevel: any;
}>;
/**
 * River polylines in region metres, traced downstream from every sample whose drainage reaches
 * `threshold` samples. Tributaries end where they join a river already traced. Rivers are sorted
 * largest first and capped at `maxRivers`.
 */
export function rivers(f: any, flowResult: any, spec?: {}): readonly Readonly<{
    points: any;
    drainage: any;
    drainageAlong: readonly any[];
}>[];
/**
 * Contour lines at `level` metres by marching squares. Returns polylines in region metres;
 * closed rings repeat their first point at the end.
 */
export function contours(f: any, level: any, spec?: {}): readonly (readonly any[])[];
/**
 * Lay a polyline on the terrain: resample it every `step` metres and give each point the ground
 * height times `exaggeration`, plus `lift` so a river or road sits just above the surface.
 */
export function drape(points: any, f: any, spec?: {}): readonly any[];
/** A colour ramp by elevation: stops are [{metres, color}] in increasing order. Returns an HSLA string. */
export function elevationRamp(stops: any): (metres: any) => any;
/**
 * Seeded cloud placement over high ground. Clouds favour higher samples, keep `spacing` apart,
 * stay outside every `avoid` circle (the subject of the current beat) and float at
 * `altitudeFactor` times the highest exaggerated peak. Work is bounded by `attempts` per cloud.
 */
export function placeClouds(f: any, spec?: {}): Readonly<{
    clouds: readonly Readonly<{
        x: any;
        y: any;
        z: number;
        size: number;
        sprite: number;
        drift: number;
    }>[];
    missing: number;
    tries: number;
}>;
/**
 * A river draw-on: reveal(time) gives the drawn fraction, the length drawn and the tip position.
 * Use the fraction to trim the river line and the tip to place its brighter head.
 */
export function riverReveal(points: any, spec?: {}): Readonly<{
    length: number | undefined;
    reveal(time: any): Readonly<{
        fraction: any;
        length: number;
        tip: Readonly<{
            x: any;
            y: any;
            z: any;
        }>;
        headStart: number;
        drawing: boolean;
    }>;
}>;
