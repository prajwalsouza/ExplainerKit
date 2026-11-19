// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A length in metres from a tag such as "12", "12 m", "12.5m", "40'" or "40 ft". */
export function parseLength(value: any): number | undefined;
/** A count such as floors or lanes. "3;4" (several values) gives the largest. */
export function parseCount(value: any): number | undefined;
/** An OSM colour tag as an HSLA string, or undefined for values that are not colours. */
export function parseColour(value: any): string | undefined;
/**
 * A direction in degrees clockwise from north, from a tag such as "45", "270.5", "45;225" (the
 * first value is read) or a compass word such as N, NE or NNW. Other values give undefined.
 */
export function parseDirection(value: any): number | undefined;
/**
 * A construction year from a tag such as "1905", "1905-06-12", "~1900" or "C19" (the middle of the
 * century, 1850). Other text gives its first four-digit year, so "early 1900s" gives 1900, and
 * text without one, such as "early 20th century", gives undefined.
 */
export function parseYear(value: any): any;
/**
 * Parse Overpass JSON text into projected street features.
 *
 * `bbox` ({south, west, north, east} in degrees) keeps only features that reach into the box and
 * sets the projection centre; `center` ({lon, lat}) overrides that centre. Coordinates come back
 * in metres east (x) and north (y) of the centre. Every input is bounded; see `osmLimits`.
 */
export function parseOverpass(source: any, spec?: {}): Readonly<{
    projection: Readonly<{
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
    center: Readonly<{
        lon: any;
        lat: any;
    }>;
    bbox: Readonly<{
        x0: any;
        y0: any;
        x1: any;
        y1: any;
        south: any;
        west: any;
        north: any;
        east: any;
    }> | null;
    buildings: any;
    roads: readonly any[];
    water: readonly any[];
    green: readonly any[];
    trees: readonly any[];
    lamps: readonly any[];
    crossings: readonly any[];
    amenities: readonly any[];
    places: any;
    barriers: readonly any[];
    rails: readonly any[];
    areas: readonly any[];
    entrances: any;
    zones: readonly Readonly<{
        id: any;
        kind: string;
        ring: readonly any[] | null;
        holes: readonly (readonly any[] | null)[];
    }>[];
    attribution: Readonly<{
        text: "© OpenStreetMap contributors";
        url: "https://www.openstreetmap.org/copyright";
        license: "Open Database License (ODbL) 1.0";
    }>;
    timestamp: any;
}>;
/**
 * Counts of a parseOverpass result: for each list, `count` and `kinds`, the number of features of
 * each kind (roads by `highway`, trees by `leaf`, lamps by `mount`, places by `category`). At most
 * `osmLimits.summaryKinds` kinds are named per list, and the rest are counted under `other`.
 */
export function osmSummary(parsed: any): Readonly<{}>;
/** Overpass QL for every feature parseOverpass reads inside a box, as JSON with inline geometry. */
export function overpassQuery(bbox: any, spec?: {}): string;
export const osmLimits: Readonly<{
    textLength: number;
    elements: 400000;
    buildings: 20000;
    roads: 20000;
    areas: 5000;
    points: 50000;
    ringVertices: 4000;
    totalVertices: 2000000;
    relationMembers: 2000;
    treesPerRow: 2000;
    containmentChecks: 20000000;
    amenities: 50000;
    places: 20000;
    barriers: 20000;
    rails: 5000;
    areaFeatures: 10000;
    entrances: 50000;
    zones: 2000;
    summaryKinds: 64;
}>;
export const osmAttribution: Readonly<{
    text: "© OpenStreetMap contributors";
    url: "https://www.openstreetmap.org/copyright";
    license: "Open Database License (ODbL) 1.0";
}>;
export const buildingKinds: readonly string[];
export const roofShapes: readonly string[];
export const roadClasses: readonly string[];
export const amenityKinds: readonly string[];
export const placeCategories: readonly string[];
export const areaKinds: readonly string[];
