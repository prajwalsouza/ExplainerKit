// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Interpolate measurements between recorded pitches and two recorded dynamic layers. */
export function pianoProfile(midi: any, velocity: any): any;
export function partialEnvelope(levels: any, rate: any): {
    boundaries: number[];
    steps: number[];
    knots: any[];
    segment: number;
    value: number;
    frame: number;
};
export function envelopeAt(envelope: any, frame: any): any;
