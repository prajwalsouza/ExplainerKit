// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Project sampled scene values onto existing HTML/CSS elements. No animation loop. */
export function bindDOM(scene: any, bindings: any, spec?: {}): Readonly<{
    update: (next?: any) => Readonly<{
        time: any;
        width: any;
        height: any;
        reducedMotion: any;
    }>;
    dispose: () => void;
    readonly disposed: boolean;
    readonly time: any;
    readonly reducedMotion: any;
    readonly error: any;
}>;
