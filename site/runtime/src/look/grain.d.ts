// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Time-addressed monochrome grain. Returns explicit overlays, never a hidden postprocess. */
export function filmGrain(spec?: {}): Readonly<{
    settings: Readonly<{
        width: any;
        height: any;
        size: any;
        intensity: any;
        rate: any;
        seed: number;
        maxPixels: any;
        maxNodes: any;
    }>;
    columns: number;
    rows: number;
    frameAt: (time: any) => number;
    pixels(time?: number): Readonly<{
        width: any;
        height: any;
        frame: number;
        data: Uint8ClampedArray<ArrayBuffer>;
    }>;
    blueprint(time?: number): Readonly<{
        type: "group";
        props: Readonly<{}>;
        children: any;
    }>;
    width: any;
    height: any;
    size: any;
    intensity: any;
    rate: any;
    seed: number;
    maxPixels: any;
    maxNodes: any;
}>;
