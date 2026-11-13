// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Configuration is validated before the scene adopts it; shutter inputs resolve per sample. */
export function motionBlurSpec(spec: any, owns: any, read: any): Readonly<{
    shutter: any;
    samples: any;
    fps: any;
    auto: boolean;
    threshold: any;
}>;
/** Largest projected probe displacement in CSS pixels over one nominal frame. */
export function projectedMotion(previous: any, current: any): number;
