// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {SoundPCM,PCMInput} from './pcm.js';
import type {SoundEffectKind,SoundEffectOptions} from './effects.js';
import type {Pitch,InstrumentKind,NoteOptions,ChordOptions} from './instruments.js';
type CueTime = {at?:number;beat?:never}|{at?:never;beat:number};
type CueLength = {duration?:number;beats?:never}|{duration?:never;beats:number};
interface CueCommon {id?:string;gain?:number;role?:'effect'|'music'|'narration';align?:'start'|'peak'|'end';}
type CueSource =
 | (CueLength & {effect:SoundEffectKind;note?:never;chord?:never;sound?:never;options?:SoundEffectOptions})
 | (CueLength & {effect?:never;note:Pitch;chord?:never;sound?:never;options?:NoteOptions})
 | (CueLength & {effect?:never;note?:never;chord:readonly Pitch[];sound?:never;options?:ChordOptions})
 | {effect?:never;note?:never;chord?:never;sound:PCMInput;duration?:never;beats?:never;options?:never};
export type SoundCue = CueTime & CueCommon & CueSource;
export interface SoundtrackOptions {tempo?:number;sampleRate?:number;duckGain?:number;attack?:number;release?:number;threshold?:number;}
export interface CueDescriptor {readonly id:string;readonly at:number;readonly start:number;readonly duration:number;readonly gain:number;readonly role:'effect'|'music'|'narration';readonly align:'start'|'peak'|'end';readonly anchorOffset:number;readonly source:'effect'|'note'|'chord'|'sound';}
export interface Soundtrack {readonly duration:number;readonly tempo:number;readonly sampleRate:number;readonly cues:readonly CueDescriptor[];sample(time:number):readonly[number,number];render(options?:{from?:number;duration?:number;sampleRate?:number}):SoundPCM&{readonly clippedSamples:number};}
export declare function createSoundtrack(cues:readonly SoundCue[],options?:SoundtrackOptions):Soundtrack;
export declare function cueForMotion(effect:SoundEffectKind,motion:{at?:number;duration:number;ease?:unknown},options?:{id?:string;anchor?:'start'|'end';duration?:number;options?:SoundEffectOptions;gain?:number}):SoundCue;
export declare function musicPhrase(sequence:readonly(Pitch|readonly Pitch[]|null)[],options?:{tempo?:number;stepBeats?:number;gate?:number;swing?:number;instrument?:InstrumentKind;velocity?:number;seed?:string|number;sampleRate?:number}):SoundPCM&{readonly clippedSamples:number};
