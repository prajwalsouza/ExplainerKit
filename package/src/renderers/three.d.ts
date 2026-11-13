// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Caller supplies Three.js explicitly. No import, renderer creation or RAF occurs. */
export function createThreeAdapter(spec?: {}): Readonly<{
    readonly scene: any;
    readonly camera: any;
    readonly frame: any;
    /** The current light rig (frozen). */
    readonly light: Readonly<{
        ambient: any;
        key: any;
        direction: any;
        ambientColor: any;
        keyColor: any;
        sky: any;
        ground: any;
        hemisphere: any;
        shadowRadius: any;
        shadowMapSize: any;
        shadowBias: any;
        shadowNormalBias: any;
    }>;
    setLight: (partial?: {}) => Readonly<{
        ambient: any;
        key: any;
        direction: any;
        ambientColor: any;
        keyColor: any;
        sky: any;
        ground: any;
        hemisphere: any;
        shadowRadius: any;
        shadowMapSize: any;
        shadowBias: any;
        shadowNormalBias: any;
    }>;
    setShadowFocus: (center: any, radius: any) => void;
    setPalette: (map: MaterialPalette | null) => void;
    readonly disposed: boolean;
    readonly capabilities: Readonly<{
        coordinateSystem: any;
        solidPaint: true;
        extrusion: true;
        standardMaterial: true;
        externalAssets: true;
        shadows: any;
        text: false;
        clip: false;
        gradients: false;
        groupAlpha: boolean;
        groupOpacity: any;
        compoundPaths: true;
        circleSegments: any;
        nativeStrokePixels: 1;
    }>;
    object(id: any): any;
    update(input: any, settings: any): any;
    render(input: any, settings: any): any;
    setCamera(next: any): void;
    setAssets(next: any): void;
    dispose: () => void;
}>;
/** Optional renderer convenience; the caller still imports and supplies Three.js. */
export function createThreeRenderer(container: any, spec?: {}): Readonly<{
    element: any;
    readonly scene: any;
    readonly camera: any;
    readonly frame: any;
    readonly capabilities: Readonly<{
        coordinateSystem: any;
        solidPaint: true;
        extrusion: true;
        standardMaterial: true;
        externalAssets: true;
        shadows: any;
        text: false;
        clip: false;
        gradients: false;
        groupAlpha: boolean;
        groupOpacity: any;
        compoundPaths: true;
        circleSegments: any;
        nativeStrokePixels: 1;
    }>;
    render(frame: any, settings: any): void;
    setCamera: (next: any) => void;
    setAssets: (next: any) => void;
    setLight: (partial: any) => Readonly<{
        ambient: any;
        key: any;
        direction: any;
        ambientColor: any;
        keyColor: any;
        sky: any;
        ground: any;
        hemisphere: any;
        shadowRadius: any;
        shadowMapSize: any;
        shadowBias: any;
        shadowNormalBias: any;
    }>;
    /** @param {MaterialPalette|null} map */
    setPalette(map: MaterialPalette | null): void;
    dispose: () => void;
}>;
export { darkClay } from "./material-palette.js";
export type MaterialPalette = (colour: string, context: Readonly<{
    id: string;
    role: "fill" | "stroke";
    hasMap: false;
}>) => (string | {
    h: number;
    s: number;
    l: number;
    a?: number;
});
