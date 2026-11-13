// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Seconds for a delay time given as seconds or as a note value such as `'1/8d'` at a tempo. */
export function noteSeconds(value: any, tempo: any, name?: string): any;
/** Stereo delay with filtered, optionally saturated feedback. `pingPong` bounces repeats between sides. */
export function delay(buffer: any, params: any, context?: {}): void;
/** Several slowly detuned copies. It thickens a pad or a single-voice string line. */
export function chorus(buffer: any, params: any): void;
/** Three delay lines swept by a slow and a fast oscillator a third of a cycle apart, as in string machines. */
export function ensemble(buffer: any, params: any): void;
/** A very short swept delay with feedback, giving a moving comb filter. */
export function flanger(buffer: any, params: any): void;
/** A chain of swept all-pass stages whose notches move through the spectrum. */
export function phaser(buffer: any, params: any): void;
/** Periodic level change. With `stereo` at 1 the two sides move in opposition, which pans the sound. */
export function tremolo(buffer: any, params: any): void;
/** Shift pitch by reading two overlapping grains from a moving delay. Duration is unchanged. */
export function pitchShift(buffer: any, params: any): void;
/** Octave-raised copies fed into a long reverb, which adds a bright halo above the source. */
export function shimmer(buffer: any, params: any): void;
