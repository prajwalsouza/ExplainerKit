// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function cameraDefaults(scene: any, spec: any): Readonly<{
    x: any;
    y: any;
    zoom: any;
    rotation: any;
    anchorX: any;
    anchorY: any;
}>;
/** A view over a scene. Camera motion never writes the scene's model positions. */
export class Camera {
    constructor(scene: any, handle: any, samplePose: any, defaults: any, spec: any);
    _isScreenRoot(id: any): boolean;
    set(input: any): this;
    to(at: any, input: any, spec?: {}): this;
    bind(property: any, spec: any): this;
    unbind(property: any): this;
    clearAnimation(property: any): this;
    /** Follow a live node origin; rotation optionally aligns the view with its local +x axis. */
    follow(target: any, spec?: {}): this;
    _stagingState(): {
        keepingTargets: any[];
        targets: any[];
        bindings: boolean;
    };
    unfollow(): this;
    /** Fit a fixed world rectangle immediately. Padding is in screen pixels. */
    frame(region: any, spec?: {}): this;
    /** An authored zoom/pan to a rectangle, recomputed for the actual viewport on every sample. */
    zoomTo(region: any, spec?: {}): this;
    clearFraming(): this;
    /** Additive ambient velocity; fractional zoom rate is integrated with log1p.
     * @param {import('./shots.js').DriftSpec} [spec]
     */
    drift(spec?: import("./shots.js").DriftSpec): this;
    clearDrift(): this;
    /** Install one pure chronological choreography. Regions must already be registered.
     * @param {import('./shots.js').CameraShot[]} input
     */
    shots(input: import("./shots.js").CameraShot[]): this;
    clearShots(): this;
    /** Live geometric fitting from the already-sampled world frame.
     * @param {any|any[]} handles
     * @param {{padding?:number,ground?:'bottom'|'center',at?:number,until?:number}} [spec]
     */
    keep(handles: any | any[], spec?: {
        padding?: number;
        ground?: "bottom" | "center";
        at?: number;
        until?: number;
    }): this;
    clearKeeping(): this;
    /** Finite sampled speed diagnostics for stationary world points at the initial viewport corners.
     * @param {{width?:number,height?:number,samples?:number,fps?:number}} [spec]
     */
    shotReport(spec?: {
        width?: number;
        height?: number;
        samples?: number;
        fps?: number;
    }): readonly (Readonly<{
        kind: any;
        at: any;
        end: any;
        sampledPeakPxPerSecond: null;
        sampledPeakPxPerFrame: null;
        samples: 0;
    }> | Readonly<{
        kind: any;
        at: any;
        end: any;
        sampledPeakPxPerSecond: number;
        sampledPeakPxPerFrame: number;
        samples: any;
    }>)[];
    /** Keep a top-level drawable in screen space. Native HTML controls are already outside the camera. */
    overlay(handle: any): this;
    removeOverlay(handle: any): this;
    /** Keep a live root backdrop in screen space, below the projected world. */
    underlay(handle: any): this;
    removeUnderlay(handle: any): this;
    project(frame: any, context: any): {
        underlayRoots?: any;
        screenRoots?: readonly any[] | undefined;
        frame: any;
        pose: Readonly<{
            x: any;
            y: any;
            zoom: any;
            rotation: any;
            anchorX: any;
            anchorY: any;
        }>;
        matrix: any;
        inverse: any;
        overlayRoots: any;
    };
    view(spec?: {}): Readonly<{
        underlayRoots?: any;
        screenRoots?: readonly any[] | undefined;
        pose: Readonly<{
            x: any;
            y: any;
            zoom: any;
            rotation: any;
            anchorX: any;
            anchorY: any;
        }>;
        matrix: any;
        inverse: any;
        overlayRoots: any;
    }>;
    worldToScreen(point: any, spec?: {}): Readonly<{
        x: any;
        y: any;
    }>;
    screenToWorld(point: any, spec?: {}): Readonly<{
        x: any;
        y: any;
    }>;
    #private;
}
export { MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM, cameraMatrix, invertMatrix, multiplyMatrices, transformPoint, fitRegion, worldPose } from "./math.js";
export { layerPose, focusBlur, projectLayer, shutterTimes } from "./depth.js";
