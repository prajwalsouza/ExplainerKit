// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {SoundPCM,PCMInput} from './pcm.js';
import type {Pitch} from './instruments.js';
export interface SampleZone {id?:string;pcm:PCMInput;rootPitch:Pitch;pitch?:readonly[number,number];velocity?:readonly[number,number];gain?:number;}
export interface SampleNoteOptions {velocity?:number;duration?:number;gain?:number;pan?:number;release?:number;}
export interface SampleBank {readonly name:string;readonly zones:readonly Readonly<{id:string;rootPitch:number;pitch:readonly number[];velocity:readonly number[]}>[];note(pitch:Pitch,options?:SampleNoteOptions):SoundPCM;chord(pitches:readonly Pitch[],options?:SampleNoteOptions):SoundPCM;}
export declare function sampleInstrument(zones: readonly SampleZone[], options?: {name?:string;sampleRate?:number}): SampleBank;
