// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
import type {CharacterHandle} from './runtime.js';
export interface ContactTimingOptions {from:number;to:number;hand?:'F'|'B';fps?:number;maxSpeedRatio?:number;target?:readonly [number,number];radius?:number;}
interface ContactEvidence {readonly reason:string;readonly peakTime:number;readonly peakSpeed:number;readonly travel:number;readonly sampleStep:number;}
export type ContactTiming=ContactEvidence & (Readonly<{status:'known';at:number;speed:number;speedRatio:number}>|Readonly<{status:'unknown';at:null;speed:null;speedRatio:null}>);
export function contactTiming(actor:Pick<CharacterHandle,'socket'>,options:ContactTimingOptions):ContactTiming;
export interface ContactHoldOptions extends Omit<ContactTimingOptions,'target'> {until:number;anchor?:readonly [number,number];offset?:readonly [number,number];align?:'hand'|'upright';blend?:number;release?:'freeze'|'authored';}
export function holdAtContact(actor:CharacterHandle,prop:Parameters<CharacterHandle['hold']>[0],options:ContactHoldOptions):Readonly<{timing:ContactTiming;hold:ReturnType<CharacterHandle['hold']>|null}>;
