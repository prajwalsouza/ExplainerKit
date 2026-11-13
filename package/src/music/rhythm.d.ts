// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Spectral features at about 100 frames per second. */
export function onsetFeatures(signal: any, rate: any): {
    fps: number;
    hop: number;
    size: number;
    count: number;
    envelope: Float64Array<ArrayBuffer>;
    lowFlux: Float64Array<ArrayBuffer>;
    midFlux: Float64Array<ArrayBuffer>;
    highFlux: Float64Array<ArrayBuffer>;
    centroid: Float32Array<ArrayBuffer>;
    bandEnergy: Float32Array<ArrayBuffer>;
    timbre: Float32Array<ArrayBuffer>;
    timbreSize: number;
};
/** Normalise an envelope so its 99th percentile is one. */
export function normalise(envelope: any): Float64Array<ArrayBuffer>;
/**
 * Onsets by adaptive peak picking (Böck, Krebs and Schedl, ISMIR 2012): a
 * frame is an onset when it is the local maximum within ±30 ms, exceeds the
 * local mean over −100…+70 ms by `delta`, and is at least 30 ms after the
 * previous onset.
 */
export function pickOnsets(envelope: any, fps: any, delta?: number): {
    frame: number;
    strength: any;
}[];
/**
 * Global tempo and a slowly varying local beat period. `range` bounds the
 * answer in BPM. A `hint` replaces the 120 BPM prior centre when the caller
 * knows the rough tempo.
 */
export function estimateTempo(envelope: any, fps: any, range?: number[], hint?: number): {
    bpm: number;
    period: number;
    confidence: number;
    candidates: {
        bpm: number;
        score: number;
    }[];
    local: {
        frame: number;
        period: number;
    }[];
};
/**
 * Ellis's dynamic-programming beat tracker. Each frame's score is its local
 * onset strength plus the best earlier score, penalised by how far the gap
 * departs from the expected period on a log scale.
 */
export function trackBeats(envelope: any, fps: any, tempo: any, tightness?: number): number[];
/**
 * Assign each beat a position in its bar. Downbeat evidence is a standardised
 * per-beat score; the Viterbi path advances one position per beat and pays a
 * penalty to restart a bar early or late.
 */
export function trackBars(evidence: any, beatsPerBar: any, restart?: number): Int8Array<any>;
/** Choose 3 or 4 beats per bar by how strongly one beat phase stands out. */
export function chooseMeter(evidence: any): {
    beatsPerBar: number;
    contrast: number;
};
