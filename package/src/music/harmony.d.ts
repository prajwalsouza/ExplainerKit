// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export type ChordQuality = 'maj' | 'min' | '7' | 'maj7' | 'min7' | 'dim' | 'sus4';
export declare const PITCH_NAMES: readonly ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export declare const CHORD_QUALITIES: Readonly<Record<ChordQuality, {readonly intervals: readonly number[]; readonly suffix: string}>>;
export declare const CHORD_VOCABULARIES: {readonly triads: readonly ChordQuality[]; readonly sevenths: readonly ChordQuality[]};
export declare function pitchFeatures(signal: Float32Array, rate: number, hopSeconds?: number): {pitch: Float32Array; semitones: number; count: number; step: number; tuning: number};
export declare function chromaOver(features: {pitch: Float32Array; semitones: number; count: number; step: number}, spans: readonly (readonly [number, number])[]): {treble: Float32Array; bass: Float32Array; energy: Float32Array};
export declare function chordName(root: number, quality: ChordQuality | null): string;
export declare function labelChords(chroma: {treble: Float32Array; bass: Float32Array; energy: Float32Array}, strength: readonly number[], vocabulary?: 'triads' | 'sevenths'): {path: Int16Array; chords: {root: number; quality: ChordQuality | null}[]; confidence: Float64Array};
export declare function estimateKey(profile: readonly number[]): {tonic: string; tonicIndex: number; mode: 'major' | 'minor'; name: string; correlation: number; confidence: number};
export declare function romanNumeral(root: number, quality: ChordQuality | null, tonic: number): string;
