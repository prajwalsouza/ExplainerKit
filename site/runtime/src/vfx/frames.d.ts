// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function grayFrame(input: any): {
    width: any;
    height: any;
    gray: Uint8Array<ArrayBuffer>;
};
export function exclusions(input?: any[]): any;
export function patchFits(frame: any, x: any, y: any, excluded?: any[]): boolean;
export function regionOf(input: any): {
    bounds: {
        x: any;
        y: any;
        width: any;
        height: any;
    };
    quad: any;
    includes: (px: any, py: any) => any;
};
export function featuresIn(frame: any, { bounds: region, includes }: {
    bounds: any;
    includes: any;
}, excluded: any): any[];
export function frameStats(frame: any, { bounds: region, includes }: {
    bounds: any;
    includes: any;
}): {
    brightness: number;
    contrast: number;
    darkFraction: number;
    brightFraction: number;
};
export function cutHint(a: any, b: any): boolean;
