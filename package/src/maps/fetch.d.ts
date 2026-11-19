// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A cache kept in memory for this page or process. Pass your own {get, set} for anything lasting. */
export function memoryCache(spec?: {}): Readonly<{
    get(key: any): Promise<any>;
    set(key: any, bytes: any): Promise<void>;
}>;
/** The Copernicus tile names and URLs that cover a bounding box, one per whole degree. */
export function elevationTiles(bbox: any, spec?: {}): readonly Readonly<{
    name: string;
    lat: number;
    lon: number;
    url: `https://copernicus-dem-90m.s3.amazonaws.com/${string}/${string}.tif` | `https://copernicus-dem-30m.s3.amazonaws.com/${string}/${string}.tif`;
}>[];
/**
 * Download the elevation a region needs, only when called, and build a heightfield of
 * `columns` x `rows` samples in metres around the region's centre. Tiles over open sea do not
 * exist; their samples are 0, as the data provider specifies. Returns {field, projection,
 * tiles, sources}.
 */
export function loadElevation(spec?: {}): Promise<Readonly<{
    field: Readonly<{
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
        values: () => Float64Array<ArrayBuffer>;
        at(i: any, j: any): number;
        sample(x: any, y: any): number;
        position(i: any, j: any): Readonly<{
            x: any;
            y: number;
        }>;
        normal(x: any, y: any, exaggeration?: number): Readonly<{
            x: number;
            y: number;
            z: number;
        }>;
        slope(x: any, y: any, exaggeration?: number): number;
    }>;
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
    tiles: readonly Readonly<{
        name: string;
        url: `https://copernicus-dem-90m.s3.amazonaws.com/${string}/${string}.tif` | `https://copernicus-dem-30m.s3.amazonaws.com/${string}/${string}.tif`;
        sea: boolean;
        cached: boolean;
    }>[];
    sources: readonly (Readonly<{
        name: "Copernicus DEM GLO-90";
        url: "https://copernicus-dem-90m.s3.amazonaws.com/";
        licence: "Copernicus DEM licence, free for the general public: https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        licenceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        attribution: "Copernicus DEM GLO-90. Show the attribution wording required by the licence at https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model.";
        attributionRequired: true;
        attributionVerified: false;
    }> | Readonly<{
        name: "Copernicus DEM GLO-30 Public";
        url: "https://copernicus-dem-30m.s3.amazonaws.com/";
        licence: "Copernicus DEM licence, free for the general public: https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        licenceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        attribution: "Copernicus DEM GLO-30. Show the attribution wording required by the licence at https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model.";
        attributionRequired: true;
        attributionVerified: false;
    }>)[];
}>>;
/**
 * Download one Natural Earth layer when called and keep only what lies in the box. Returns
 * features as {kind, name, lines: [[{lon, lat}]], rings: [[{lon, lat}]]} plus the source.
 */
export function loadNaturalEarth(spec?: {}): Promise<Readonly<{
    features: readonly Readonly<{
        kind: any;
        name: string | null;
        lines: readonly {
            lon: any;
            lat: any;
        }[][];
        rings: readonly {
            lon: any;
            lat: any;
        }[][];
    }>[];
    sources: readonly Readonly<{
        name: "Natural Earth";
        url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
        licence: "Public domain: https://www.naturalearthdata.com/about/terms-of-use/";
        licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/";
        attribution: "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.";
        attributionRequired: false;
        attributionVerified: true;
    }>[];
}>>;
/**
 * A polite downloader for OpenStreetMap street data. It sends one request at a time, waits at
 * least `minInterval` milliseconds between requests, tries `endpoints` in order when a server is
 * busy (429, 502, 503 or 504) or unreachable, and keeps each answer in the caller's cache. Its
 * `load(bbox)` resolves to {text, endpoint, cached, sources, attribution}; pass `text` to
 * `parseOverpass` from explainerkit/maps/osm.
 */
export function overpassClient(spec?: {}): Readonly<{
    endpoints: any;
    /** Download the street data for a small box. Calls are queued, never sent in parallel. */
    load(bbox: any): Promise<Readonly<{
        text: string;
        endpoint: any;
        cached: any;
        sources: readonly Readonly<{
            name: "OpenStreetMap";
            url: "https://overpass-api.de/api/interpreter";
            licence: "Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright";
            licenceUrl: "https://www.openstreetmap.org/copyright";
            attribution: "© OpenStreetMap contributors";
            attributionRequired: true;
            attributionVerified: true;
        }>[];
        attribution: Readonly<{
            text: "© OpenStreetMap contributors";
            url: "https://www.openstreetmap.org/copyright";
            license: "Open Database License (ODbL) 1.0";
        }>;
    }> | undefined>;
}>;
/** Download OpenStreetMap street data for one small box, only when called. See overpassClient. */
export function loadOverpass(spec?: {}): Promise<Readonly<{
    text: string;
    endpoint: any;
    cached: any;
    sources: readonly Readonly<{
        name: "OpenStreetMap";
        url: "https://overpass-api.de/api/interpreter";
        licence: "Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright";
        licenceUrl: "https://www.openstreetmap.org/copyright";
        attribution: "© OpenStreetMap contributors";
        attributionRequired: true;
        attributionVerified: true;
    }>[];
    attribution: Readonly<{
        text: "© OpenStreetMap contributors";
        url: "https://www.openstreetmap.org/copyright";
        license: "Open Database License (ODbL) 1.0";
    }>;
}> | undefined>;
/**
 * Load a region baked by scripts/maps/bake-region.mjs from `base` (a folder URL ending in /).
 * Returns {field, projection, water: {rivers, lakes, coastline} in region metres, sources, meta}.
 */
export function loadBakedRegion(spec?: {}): Promise<Readonly<{
    field: Readonly<{
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
        values: () => Float64Array<ArrayBuffer>;
        at(i: any, j: any): number;
        sample(x: any, y: any): number;
        position(i: any, j: any): Readonly<{
            x: any;
            y: number;
        }>;
        normal(x: any, y: any, exaggeration?: number): Readonly<{
            x: number;
            y: number;
            z: number;
        }>;
        slope(x: any, y: any, exaggeration?: number): number;
    }>;
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
    water: Readonly<{}>;
    sources: any;
    meta: any;
}>>;
export const SOURCES: Readonly<{
    copernicus90: Readonly<{
        name: "Copernicus DEM GLO-90";
        url: "https://copernicus-dem-90m.s3.amazonaws.com/";
        licence: "Copernicus DEM licence, free for the general public: https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        licenceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        attribution: "Copernicus DEM GLO-90. Show the attribution wording required by the licence at https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model.";
        attributionRequired: true;
        attributionVerified: false;
    }>;
    copernicus30: Readonly<{
        name: "Copernicus DEM GLO-30 Public";
        url: "https://copernicus-dem-30m.s3.amazonaws.com/";
        licence: "Copernicus DEM licence, free for the general public: https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        licenceUrl: "https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model";
        attribution: "Copernicus DEM GLO-30. Show the attribution wording required by the licence at https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model.";
        attributionRequired: true;
        attributionVerified: false;
    }>;
    naturalEarth: Readonly<{
        name: "Natural Earth";
        url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
        licence: "Public domain: https://www.naturalearthdata.com/about/terms-of-use/";
        licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/";
        attribution: "Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.";
        attributionRequired: false;
        attributionVerified: true;
    }>;
    openStreetMap: Readonly<{
        name: "OpenStreetMap";
        url: "https://overpass-api.de/api/interpreter";
        licence: "Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright";
        licenceUrl: "https://www.openstreetmap.org/copyright";
        attribution: "© OpenStreetMap contributors";
        attributionRequired: true;
        attributionVerified: true;
    }>;
}>;
/** Public Overpass servers tried in order. The main one sometimes answers 502 or 504 when busy. */
export const OVERPASS_ENDPOINTS: readonly string[];
export { overpassQuery };
import { overpassQuery } from './osm.js';
