// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Register an instrument. `render(voice)` adds one note into `voice.left` and
 * `voice.right`, starting at `voice.start`. `release` is the longest time a
 * note keeps sounding after its gate closes, and `cost` estimates work per frame.
 */
export function defineInstrument({ kind, name, release, cost, range }: {
    kind: any;
    name: any;
    release: any;
    cost: any;
    range?: number[] | undefined;
}, render: any): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
export function instrumentRenderer(instrument: any): any;
/** Equal-power pan gains for one voice. */
export function panGains(pan: any): number[];
/** Render one note of a studio instrument to stereo PCM, for auditioning or building a sound effect. */
export function playInstrument(instrument: any, pitch: any, settings?: {}): Readonly<{
    sampleRate: any;
    channels: readonly any[];
    duration: number;
}>;
/**
 * Combine instruments into one. Each layer can be limited to a pitch range,
 * transposed and levelled. Ranges that overlap by `blend` semitones crossfade.
 */
export function layerInstruments(layers: any, settings?: {}): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
/** Frames between control-rate values, such as a track's expression curve. */
export const CONTROL_FRAMES: 64;
