// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export interface PCMInput {channels: readonly (readonly number[] | Float32Array | Float64Array)[]; sampleRate: number; duration?: number; metadata?: Readonly<Record<string, unknown>>; clippedSamples?: number;}
export interface SoundPCM {readonly channels: readonly Float32Array[]; readonly sampleRate: number; readonly duration: number; readonly metadata: Readonly<Record<string, unknown>>;}
export type SoundOperation = {type:'trim';from?:number;to?:number} | {type:'fade';attack?:number;release?:number} | {type:'gain'|'pan'|'normalize';value?:number} | {type:'reverse'} | {type:'lowpass'|'highpass'|'bandpass'|'eq';frequency?:number;q?:number;gain?:number} | {type:'delay';time?:number;feedback?:number;mix?:number;tail?:number} | {type:'reverb';seconds?:number;decay?:number;mix?:number;tail?:number;seed?:string|number} | {type:'limit';threshold?:number};
export declare const SAMPLE_BUDGET: number;
export declare function capturePCM(input: PCMInput): SoundPCM;
export declare function processSound(input: PCMInput, operations?: readonly SoundOperation[]): SoundPCM;
export declare function sampleRate(value?: number): number;
export declare function dense<T>(input: readonly T[], name?: string, max?: number): T[];
export declare function allocate(count: number, channels?: number): Float32Array[];
export declare function result(channels: Float32Array[], rate: number, metadata?: Readonly<Record<string, unknown>>): SoundPCM;
export declare function rng(seed?: string | number): () => number;
export declare function peakOf(channels: readonly Float32Array[]): number;
export declare function scalePeak(channels: Float32Array[], peak?: number): Float32Array[];
export declare function fades(channels: readonly Float32Array[], rate: number, attack?: number, release?: number): readonly Float32Array[];
