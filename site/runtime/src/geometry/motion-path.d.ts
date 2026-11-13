// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A reusable position/tangent sampler driven by progress, independent from wall time. */
export function motionPath(commands: any, spec?: {}): Readonly<{
    length: number | undefined;
    closed: any;
    sample(progress: any): Readonly<{
        x: number;
        y: any;
        rotation: any;
    }>;
}>;
/** Bind an ordinary scene parameter/derived value to real motion along a path. */
export function bindMotionPath(handle: any, spec?: {}): Readonly<{
    handle: any;
    path: Readonly<{
        length: number | undefined;
        closed: any;
        sample(progress: any): Readonly<{
            x: number;
            y: any;
            rotation: any;
        }>;
    }>;
}>;
