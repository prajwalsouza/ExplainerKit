// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type { Pitch } from '../instruments.js';

/** Decoded audio accepted by studio calls. One channel is treated as mono. */
export interface StudioAudioInput {
  readonly sampleRate: number;
  readonly channels: readonly (Float32Array | Float64Array)[];
}
/** Stereo PCM returned by studio calls. */
export interface StudioAudio {
  readonly sampleRate: number;
  readonly channels: readonly [Float32Array, Float32Array];
  readonly duration: number;
}
/** A value that changes over time, with linear ramps between points. */
export interface AutomationPoint {
  readonly time: number;
  readonly value: number;
}
export type Control = number | readonly AutomationPoint[];

export declare const STUDIO_LIMITS: Readonly<{ seconds: number; samples: number; effects: number }>;
export declare function dbToGain(db: number): number;
export declare function gainToDb(gain: number): number;

export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass' | 'peak' | 'lowshelf' | 'highshelf';
export declare const FILTER_TYPES: readonly FilterType[];
export interface EqBand {
  readonly type?: FilterType;
  readonly frequency?: number;
  readonly q?: number;
  readonly gain?: number;
  readonly slope?: 12 | 24 | 36 | 48;
}
export type BiquadCoefficients = [b0: number, b1: number, b2: number, a1: number, a2: number];
export declare function biquadCoefficients(type: FilterType, frequency: number, rate: number, q?: number, gainDb?: number): BiquadCoefficients;
export declare function filterResponse(bands: readonly EqBand[], frequencies: readonly number[], sampleRate?: number): number[];

export type ReverbPreset = 'room' | 'chamber' | 'plate' | 'hall' | 'cathedral' | 'ambient';
export declare const REVERB_PRESETS: Readonly<Record<ReverbPreset, Readonly<{ decay: number; size: number; predelay: number; damping: number; early: number; modulation: number }>>>;
export type SaturationCurve = 'tape' | 'tube' | 'soft' | 'hard' | 'fold';
export declare const SATURATION_CURVES: readonly SaturationCurve[];
/** A delay time in seconds, or a note value such as `'1/4'`, `'1/8d'` (dotted) or `'1/8t'` (triplet). */
export type NoteValue = `1/${1 | 2 | 4 | 8 | 16 | 32}${'' | 'd' | 't'}`;
export declare function noteSeconds(value: number | NoteValue, tempo?: number, name?: string): number;

export interface CompressorSettings {
  readonly threshold?: number;
  readonly ratio?: number;
  readonly knee?: number;
  readonly attack?: number;
  readonly release?: number;
  readonly makeup?: number | 'auto';
  readonly lookahead?: number;
  readonly detector?: 'peak' | 'rms';
  readonly sidechainHighpass?: number;
  readonly key?: string;
  readonly mix?: number;
  readonly range?: number;
}
interface Bypass {
  readonly bypass?: boolean;
}
export type StudioEffect = Bypass &
  (
    | { readonly type: 'eq'; readonly bands: readonly EqBand[] }
    | { readonly type: 'filter'; readonly mode?: 'lowpass' | 'highpass' | 'bandpass' | 'notch'; readonly frequency?: Control; readonly resonance?: number; readonly slope?: 12 | 24; readonly lfo?: { readonly rate?: number; readonly depth?: number }; readonly mix?: number }
    | { readonly type: 'ladder'; readonly frequency?: Control; readonly resonance?: number; readonly drive?: number }
    | ({ readonly type: 'compressor' } & CompressorSettings)
    | { readonly type: 'multiband'; readonly crossovers?: readonly number[]; readonly bands?: readonly (CompressorSettings & { readonly gain?: number })[] }
    | { readonly type: 'limiter'; readonly ceiling?: number; readonly gain?: number; readonly lookahead?: number; readonly release?: number }
    | { readonly type: 'gate'; readonly threshold?: number; readonly ratio?: number; readonly range?: number; readonly attack?: number; readonly hold?: number; readonly release?: number; readonly sidechainHighpass?: number; readonly key?: string }
    | { readonly type: 'transient'; readonly attack?: number; readonly sustain?: number }
    | { readonly type: 'reverb'; readonly preset?: ReverbPreset; readonly decay?: number; readonly size?: number; readonly predelay?: number; readonly damping?: number; readonly bass?: number; readonly early?: number; readonly modulation?: number; readonly diffusion?: number; readonly mix?: number; readonly wet?: number; readonly dry?: number; readonly lowCut?: number; readonly highCut?: number; readonly width?: number; readonly seed?: string | number }
    | { readonly type: 'shimmer'; readonly decay?: number; readonly mix?: number; readonly dry?: number; readonly semitones?: number; readonly damping?: number }
    | { readonly type: 'delay'; readonly time?: number | NoteValue; readonly timeRight?: number | NoteValue; readonly feedback?: number; readonly mix?: number; readonly pingPong?: boolean; readonly lowCut?: number; readonly highCut?: number; readonly wow?: number; readonly drive?: number }
    | { readonly type: 'chorus'; readonly rate?: number; readonly depth?: number; readonly voices?: number; readonly mix?: number; readonly delay?: number }
    | { readonly type: 'ensemble'; readonly depth?: number; readonly mix?: number }
    | { readonly type: 'flanger'; readonly rate?: number; readonly depth?: number; readonly feedback?: number; readonly mix?: number }
    | { readonly type: 'phaser'; readonly rate?: number; readonly stages?: number; readonly low?: number; readonly high?: number; readonly feedback?: number; readonly mix?: number }
    | { readonly type: 'tremolo'; readonly rate?: number; readonly depth?: number; readonly stereo?: number }
    | { readonly type: 'pitchShift'; readonly semitones?: number; readonly grain?: number; readonly mix?: number }
    | { readonly type: 'saturation'; readonly curve?: SaturationCurve; readonly drive?: number; readonly output?: number; readonly mix?: number; readonly bias?: number }
    | { readonly type: 'bitcrush'; readonly bits?: number; readonly hold?: number; readonly mix?: number }
    | { readonly type: 'exciter'; readonly frequency?: number; readonly drive?: number; readonly amount?: number }
    | { readonly type: 'width'; readonly width?: Control; readonly lowMono?: number }
    | { readonly type: 'pan'; readonly pan?: Control }
    | { readonly type: 'haas'; readonly delay?: number; readonly side?: 'left' | 'right' }
    | { readonly type: 'gain'; readonly gain?: Control }
    | { readonly type: 'fade'; readonly in?: number; readonly out?: number }
  );
export type EffectType = StudioEffect['type'];
export declare const EFFECT_TYPES: readonly EffectType[];
/** What one effect measured while it ran. Dynamics effects report their gain reduction in decibels. */
export interface EffectReport {
  readonly type: EffectType;
  readonly maxReduction?: number;
  readonly meanReduction?: number;
  readonly makeup?: number;
  readonly limitedSamples?: number;
  readonly step?: number;
  readonly reduction?: readonly number[];
  readonly bands?: readonly Omit<EffectReport, 'type'>[];
  readonly decay?: number;
  readonly predelay?: number;
}
export interface ProcessAudioOptions {
  readonly tail?: number | 'auto';
  readonly tempo?: number;
  readonly keys?: Readonly<Record<string, StudioAudioInput>>;
  readonly curves?: boolean;
}
export declare function processAudio(input: StudioAudioInput, chain: readonly StudioEffect[], options?: ProcessAudioOptions): StudioAudio & { readonly reports: readonly EffectReport[] };
export declare function effectTail(chain: readonly StudioEffect[]): number;

export type MeterBand = 'sub' | 'bass' | 'lowMid' | 'mid' | 'presence' | 'air';
export declare const METER_BANDS: readonly Readonly<{ id: MeterBand; from: number; to: number }>[];
export interface AudioMeters {
  readonly sampleRate: number;
  readonly duration: number;
  readonly integrated: number;
  readonly momentaryMax: number;
  readonly shortTermMax: number;
  readonly range: number;
  readonly truePeak: number;
  readonly samplePeak: number;
  readonly rms: number;
  readonly crest: number;
  readonly correlation: number;
  readonly dcOffset: number;
  readonly clippedSamples: number;
  readonly bands: Readonly<Record<MeterBand, number>>;
}
export declare function measureAudio(input: StudioAudioInput): AudioMeters;

/** An instrument made by one of the factories below. Pass it to `playInstrument` or to a `produceMusic` track. */
export interface StudioInstrument {
  readonly kind: 'synth' | 'plucked' | 'modal' | 'percussion' | 'sampler' | 'layer';
  readonly name: string;
  readonly release: number;
  readonly cost: number;
  readonly range: readonly [number, number];
}
export interface InstrumentNoteOptions {
  readonly velocity?: number;
  readonly duration?: number;
  readonly sampleRate?: number;
  readonly gain?: number;
  readonly pan?: number;
  readonly seed?: number;
  readonly dynamics?: number;
}
export declare function playInstrument(instrument: StudioInstrument, pitch: Pitch, options?: InstrumentNoteOptions): StudioAudio & { readonly instrument: string; readonly midi: number };
export interface InstrumentLayer {
  readonly instrument: StudioInstrument;
  readonly gain?: number;
  readonly transpose?: number;
  readonly from?: number;
  readonly to?: number;
  readonly blend?: number;
  readonly velocity?: readonly [number, number];
}
export declare function layerInstruments(layers: readonly InstrumentLayer[], options?: { readonly name?: string }): StudioInstrument;

export interface EnvelopeSettings {
  readonly attack?: number;
  readonly decay?: number;
  readonly sustain?: number;
  readonly release?: number;
}
export interface SynthOscillator {
  readonly wave?: 'sine' | 'triangle' | 'saw' | 'square' | 'noise';
  readonly level?: number;
  readonly octave?: number;
  readonly semitones?: number;
  readonly cents?: number;
  readonly pulseWidth?: number;
  readonly unison?: number;
  readonly detune?: number;
  readonly spread?: number;
}
export interface SynthPatch {
  readonly name?: string;
  readonly oscillators?: readonly SynthOscillator[];
  readonly sub?: number;
  readonly noise?: number;
  readonly fm?: { readonly ratio?: number; readonly index?: number; readonly decay?: number; readonly sustain?: number };
  readonly filter?: { readonly mode?: 'lowpass' | 'highpass' | 'bandpass'; readonly slope?: 12 | 24; readonly cutoff?: number; readonly resonance?: number; readonly keyTrack?: number; readonly envelope?: number; readonly velocity?: number; readonly dynamics?: number; readonly lfo?: number };
  readonly filterEnvelope?: EnvelopeSettings;
  readonly envelope?: EnvelopeSettings;
  readonly lfo?: { readonly rate?: number; readonly delay?: number; readonly fade?: number };
  readonly vibrato?: number;
  readonly tremolo?: number;
  readonly drift?: number;
  readonly velocity?: number;
  readonly drive?: number;
  readonly gain?: number;
  readonly formant?: { readonly vowel?: 'ah' | 'oh' | 'oo' | 'ee' | 'mm'; readonly mix?: number; readonly q?: number };
  readonly retrigger?: boolean;
  readonly width?: number;
}
export type SynthPatchName = 'warmPad' | 'glassPad' | 'airPad' | 'choir' | 'synthStrings' | 'brass' | 'subBass' | 'deepBass' | 'pulse' | 'softLead' | 'bell' | 'electricPiano';
export declare const SYNTH_PATCHES: Readonly<Record<SynthPatchName, SynthPatch>>;
export declare function synthInstrument(patch?: SynthPatch): StudioInstrument;

export type PluckedPreset = 'harp' | 'nylon' | 'pizzicato' | 'zither';
export declare const PLUCKED_PRESETS: Readonly<Record<PluckedPreset, Readonly<{ decay: number; brightness: number; pick: number; body: readonly number[]; release: number; ring: boolean }>>>;
export interface PluckedSettings {
  readonly name?: string;
  readonly preset?: PluckedPreset;
  readonly decay?: number;
  readonly brightness?: number;
  readonly pick?: number;
  readonly body?: readonly number[];
  readonly release?: number;
  readonly ring?: boolean;
  readonly gain?: number;
  readonly keySpread?: number;
}
export declare function pluckedInstrument(settings?: PluckedSettings): StudioInstrument;

export type ModalPreset = 'celesta' | 'glockenspiel' | 'vibraphone' | 'marimba' | 'kalimba' | 'musicBox' | 'tubularBell' | 'bowl';
/** One partial as `[frequency ratio, level, decay scale]`. */
export type ModalMode = readonly [ratio: number, level: number, decay: number];
export declare const MODAL_PRESETS: Readonly<Record<ModalPreset, Readonly<{ decay: number; modes: readonly ModalMode[]; strike: number; ring: boolean; tremolo?: readonly [number, number]; gain?: number }>>>;
export interface ModalSettings {
  readonly name?: string;
  readonly preset?: ModalPreset;
  readonly modes?: readonly ModalMode[];
  readonly decay?: number;
  readonly strike?: number;
  readonly ring?: boolean;
  readonly release?: number;
  readonly hardness?: number;
  readonly gain?: number;
  readonly tremolo?: readonly [rate: number, depth: number];
  readonly width?: number;
}
export declare function modalInstrument(settings?: ModalSettings): StudioInstrument;

export type PercussionSound = 'boom' | 'taiko' | 'frame' | 'sub' | 'rim' | 'tick' | 'shaker' | 'swell' | 'riser' | 'fall';
export declare const PERCUSSION_SOUNDS: readonly PercussionSound[];
export interface PercussionKitEntry {
  readonly sound: PercussionSound;
  readonly tune?: number;
  readonly gain?: number;
  readonly pan?: number;
}
export declare const PERCUSSION_KIT: Readonly<Record<number, Readonly<PercussionKitEntry>>>;
export declare function percussionInstrument(settings?: { readonly name?: string; readonly kit?: Readonly<Record<number, PercussionKitEntry>>; readonly gain?: number; readonly width?: number }): StudioInstrument;

export interface SampledZone {
  readonly id?: string;
  readonly pcm: StudioAudioInput;
  readonly rootPitch: Pitch;
  readonly pitch?: readonly [number, number];
  readonly velocity?: readonly [number, number];
  readonly gain?: number;
  readonly tune?: number;
}
export interface SampledSettings {
  readonly name?: string;
  readonly attack?: number | readonly [quiet: number, loud: number];
  readonly release?: number;
  readonly sustain?: 'hold' | 'loop';
  readonly loop?: { readonly start?: number; readonly end?: number; readonly crossfade?: number };
  readonly dynamicRange?: number;
  readonly brightness?: { readonly low?: number; readonly high?: number; readonly keyTrack?: number };
  readonly ensemble?: { readonly voices?: number; readonly detune?: number; readonly spread?: number; readonly scatter?: number; readonly neighbours?: boolean };
  readonly vibrato?: { readonly rate?: number; readonly depth?: number; readonly delay?: number; readonly fade?: number };
  readonly startOffset?: number;
  readonly maxShift?: number;
  readonly gain?: number;
  readonly expression?: number;
  readonly mechanics?: { readonly level?: number; readonly strike?: number; readonly release?: number };
}
export declare function sampledInstrument(zones: readonly SampledZone[], settings?: SampledSettings): StudioInstrument;
