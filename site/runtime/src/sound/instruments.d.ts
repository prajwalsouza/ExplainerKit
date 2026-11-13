// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {SoundPCM} from './pcm.js';
export type Pitch = number | string;
export type InstrumentKind = 'felt' | 'mallet' | 'pluck' | 'bell' | 'glass' | 'pad';
export interface NoteOptions {instrument?:InstrumentKind;duration?:number;sampleRate?:number;velocity?:number;seed?:string|number;brightness?:number;pan?:number;reverb?:number;}
export interface ChordOptions extends NoteOptions {spread?:number;strum?:number;}
export declare const INSTRUMENT_KINDS: readonly InstrumentKind[];
export declare function midiPitch(pitch: Pitch): number;
export declare function frequencyOf(pitch: Pitch): number;
export declare function note(pitch: Pitch, options?: NoteOptions): SoundPCM;
export declare function chord(pitches: readonly Pitch[], options?: ChordOptions): SoundPCM;
