// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function captureKeeping(scene: any, handles: any, spec?: {}): Readonly<{
    ids: readonly any[];
    at: any;
    until: any;
    padding: any;
    ground: any;
}>;
/** Consume the current world frame only; never re-enters sampling or camera projection. */
export function fitKeeping(rule: any, frame: any, pose: any, screenRoots: any): Readonly<{
    x: any;
    y: any;
    zoom: any;
    rotation: any;
    anchorX: any;
    anchorY: any;
}>;
