// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Explicit enter/exit fades across identified scene states. Reparenting still rejects. */
export function createSceneTransition(from: any, to: any, spec?: {}): Readonly<{
    sample(progress: any): Readonly<{
        light?: Readonly<{
            angle: any;
            color: any;
            ambient: any;
        }> | undefined;
        width: any;
        height: any;
        children: any;
    }>;
}>;
