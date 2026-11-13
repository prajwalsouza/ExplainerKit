// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Check a chain's shape before any audio is processed. */
export function checkEffects(chain: any, name?: string): any;
/** Seconds of ringing the chain can add after its input ends. */
export function effectTail(chain: any): number;
/** Run a checked chain over a mutable stereo buffer and collect each effect's report. */
export function runEffects(buffer: any, chain: any, context?: {}): any[];
/**
 * Process decoded audio through an ordered effect chain and return new stereo
 * PCM. The input is not modified. `tail` appends silence first so reverbs and
 * delays have room to ring out.
 */
export function processAudio(input: any, chain: any, settings?: {}): Readonly<{
    sampleRate: any;
    channels: readonly any[];
    duration: number;
}>;
/** Every effect type accepted in a chain. */
export const EFFECT_TYPES: readonly string[];
