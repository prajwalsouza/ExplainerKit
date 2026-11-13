// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function validateBlur(value: any): any;
export function glow(spec?: {}): Readonly<{
    space: any;
    maxScreen: any;
    strict: any;
    color: any;
    blur: any;
    opacity: any;
}>;
export function validateGlow(value: any): Readonly<{
    space: any;
    maxScreen: any;
    strict: any;
    color: any;
    blur: any;
    opacity: any;
}> | null;
export function blendMode(value: any): any;
export function alphaMask(gradient: any, bounds: any): Readonly<{
    type: "alpha";
    gradient: any;
    bounds: Readonly<{
        x: any;
        y: any;
        width: any;
        height: any;
    }>;
}>;
export function validateMask(value: any): Readonly<{
    type: "alpha";
    gradient: any;
    bounds: Readonly<{
        x: any;
        y: any;
        width: any;
        height: any;
    }>;
}> | null;
/** Uniform world transforms make native SVG/Canvas blur radii agree. */
export function effectPlan(frame: any): Map<any, any>;
export function blurRadius(value: any): any;
export function needsIsolation(p: any): boolean;
export function effectLayers(p: any): number;
