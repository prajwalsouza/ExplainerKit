// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function rebaseCamera(spec: any, target: any): Readonly<{
    frame: any;
    x: any;
    y: any;
    zoom: any;
    rotation: any;
    anchorX: any;
    anchorY: any;
}>;
export function logZoom(from: any, to: any, progress: any): any;
/** Project relative to the camera's current frame, with no global-coordinate bake. */
export function frameView(spec: any, size?: {
    width: number;
    height: number;
}): Readonly<{
    pose: Readonly<{
        frame: any;
        x: any;
        y: any;
        zoom: any;
        rotation: any;
        anchorX: any;
        anchorY: any;
    }>;
    width: any;
    height: any;
    project: (value: any, source?: any) => Readonly<{
        x: any;
        y: any;
    }>;
    unproject: (value: any, target?: any) => Readonly<{
        x: any;
        y: any;
    }>;
    transform: (source: any) => Readonly<{
        x: any;
        y: any;
        rotation: number;
        scaleX: any;
        scaleY: any;
    }>;
    screenSize(length: any, source?: any): any;
    projectFrame(frame: any, source?: any, localSpec1?: {}): Readonly<{
        width: any;
        height: any;
        children: readonly {
            id: any;
            type: string;
            props: Readonly<{
                opacity: 1;
                x: any;
                y: any;
                rotation: number;
                scaleX: any;
                scaleY: any;
            }>;
            children: any;
        }[];
    }>;
}>;
/** Bind a top-level construction to an already derived frameView input. */
export function bindFrame(handle: any, spec?: {}): any;
/** A pure shot between local frames; rebase representation while preserving the view. */
export function zoomTransition(from: any, to: any, spec?: {}): Readonly<{
    sample(progress: any): Readonly<{
        frame: any;
        x: any;
        y: any;
        zoom: any;
        rotation: any;
        anchorX: any;
        anchorY: any;
    }>;
}>;
