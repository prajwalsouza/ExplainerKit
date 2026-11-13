// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A seeded random stream (mulberry32). The same seed always replays the same draws, so seeking stays exact. */
export function seeded(seed: any): () => number;
/**
 * A narrated timeline: one beat per caption line, timed by the line, never by the animation.
 * `at(i)` is the start of beat i in seconds; fractions move through a beat (`at(1.5)` is halfway through beat 1).
 * `lead` reserves the opening seconds (a title card); the last beat holds for `tail` extra seconds.
 */
export function beats(lines: any, spec?: {}): Readonly<{
    lines: readonly any[];
    starts: readonly any[];
    lengths: any;
    lead: any;
    duration: any;
    at: (i: any) => any;
    index: (time: any) => number;
    /** The caption showing at a time, or '' during the lead. */
    line: (time: any) => any;
    /** Eased progress through [at(from), at(from) + duration]. */
    progress: (time: any, from: any, localDuration1?: number, name?: string) => any;
}>;
/**
 * Presence: when a node is on stage. Entrances and exits multiply opacity and offset position on top of
 * whatever drives those properties, so `enter` never competes with a binding or track for ownership.
 */
export function presenceSpec(kind: any, at: any, spec?: {}): Readonly<{
    at: any;
    duration: any;
    end: any;
    lift: any;
    style: any;
    ease: any;
    pivot: any;
}>;
export function dimSpec(keys: any): readonly (readonly any[])[];
/** Apply presence to sampled properties. Before an entrance a node is invisible; after an exit it is gone. */
export function applyPresence(presence: any, props: any, time: any): any;
export function clamp(value: any, low?: number, high?: number): number;
export function lerp(from: any, to: any, progress: any): any;
/** Named easing functions and measured sample adapters.
 * @type {Readonly<{linear:(t:number)=>number,smooth:(t:number)=>number,easeOut:(t:number)=>number,easeInOut:(t:number)=>number,launch:(t:number)=>number,titleOpen:(t:number)=>number,anticipateOut:(t:number)=>number,linearStop:(t:number)=>number,snapIn:(t:number)=>number,fromSamples:typeof sampledEasing,fromTrack:typeof easingFromTrack}>}
 */
export const ease: Readonly<{
    linear: (t: number) => number;
    smooth: (t: number) => number;
    easeOut: (t: number) => number;
    easeInOut: (t: number) => number;
    launch: (t: number) => number;
    titleOpen: (t: number) => number;
    anticipateOut: (t: number) => number;
    linearStop: (t: number) => number;
    snapIn: (t: number) => number;
    fromSamples: typeof sampledEasing;
    fromTrack: typeof easingFromTrack;
}>;
export function readingPace(line: any): number;
export const DIM_DURATION: 0.7;
import { sampledEasing } from './measured-easing.js';
import { easingFromTrack } from './measured-easing.js';
