// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Read a GeoTIFF elevation tile. `bytes` is a Uint8Array or ArrayBuffer of the whole file.
 * Returns {width, height, values (Float32Array, row 0 north), bounds {west, south, east, north}
 * in the file's coordinate system, noData}. Invalid or unsupported files are refused by name.
 *
 * `inflate(bytes, maxBytes)` may be passed to decompress DEFLATE blocks where the platform has
 * no DecompressionStream. It receives the most bytes the block may need and should stop there.
 * Any extra bytes it returns are ignored.
 */
export function readGeoTIFF(bytes: any, spec?: {}): Promise<Readonly<{
    width: any;
    height: any;
    values: Float32Array<ArrayBuffer>;
    bounds: Readonly<{
        west: number;
        north: any;
        east: number;
        south: number;
        pixel: Readonly<{
            x: any;
            y: any;
        }>;
    }> | null;
    noData: number | null;
}>>;
