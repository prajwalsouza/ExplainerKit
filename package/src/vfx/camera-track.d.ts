// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Repair isolated out-and-back errors in a sampled world-to-camera pose track. */
export function stabilizeCameraTrack(input: any): Readonly<{
    samples: any;
    repaired: readonly any[];
}>;
/** Validate a measured camera track and repair isolated pose spikes by default. */
export function compileCameraTrack(input: any, spec?: {}): Readonly<{
    samples: any;
    repaired: readonly any[];
}>;
