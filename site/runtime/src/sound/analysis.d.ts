// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {PCMInput} from './pcm.js';
export interface SoundFeatures {readonly rms:number;readonly peak:number;readonly bands:readonly number[];}
export interface SoundAnalysis {readonly duration:number;readonly hop:number;readonly fftSize:number;readonly bandRanges:readonly(readonly[number,number])[];readonly frames:readonly(SoundFeatures&{readonly time:number})[];sample(time:number):SoundFeatures;}
export declare function analyzeSound(input:PCMInput,options?:{fftSize?:number;hop?:number;bands?:readonly(readonly[number,number])[];channel?:'mono'|'left'|'right'}):SoundAnalysis;
