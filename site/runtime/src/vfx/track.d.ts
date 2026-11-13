// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Copy and validate an editable point, plane or matte track before playback. */
export function compileTrack(input: any): Readonly<{
    kind: any;
    samples: any;
}>;
/** Reduce frame-to-frame noise in measured point or plane samples before playback. */
export function stabilizeTrack(track: any): Readonly<{
    kind: any;
    samples: any;
}>;
/** Sample at clip time, returning null outside the track or across a missing sample. */
export function sampleTrack(track: any, time: any): any;
