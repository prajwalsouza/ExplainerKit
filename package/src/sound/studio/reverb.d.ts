// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Algorithmic reverb built from early reflections, input diffusion and a
 * sixteen-line feedback delay network. Decay times are set per frequency band,
 * and slow modulation of the delay lines keeps long tails from ringing.
 */
export function reverb(buffer: any, params: any): {
    decay: any;
    predelay: number;
};
/** Seconds a reverb with these settings needs before its tail falls 60 dB. */
export function reverbTail(params?: {}): any;
/** Named spaces. Each is a starting point whose fields can be overridden in the effect. */
export const REVERB_PRESETS: Readonly<{
    room: Readonly<{
        decay: 0.7;
        size: 0.45;
        predelay: 0.004;
        damping: 0.45;
        early: 0.6;
        modulation: 0.15;
    }>;
    chamber: Readonly<{
        decay: 1.4;
        size: 0.7;
        predelay: 0.012;
        damping: 0.5;
        early: 0.45;
        modulation: 0.25;
    }>;
    plate: Readonly<{
        decay: 2.2;
        size: 0.55;
        predelay: 0.002;
        damping: 0.72;
        early: 0.08;
        modulation: 0.35;
    }>;
    hall: Readonly<{
        decay: 2.8;
        size: 1;
        predelay: 0.024;
        damping: 0.42;
        early: 0.3;
        modulation: 0.3;
    }>;
    cathedral: Readonly<{
        decay: 5.5;
        size: 1.5;
        predelay: 0.04;
        damping: 0.34;
        early: 0.2;
        modulation: 0.4;
    }>;
    ambient: Readonly<{
        decay: 9;
        size: 1.3;
        predelay: 0.03;
        damping: 0.5;
        early: 0.05;
        modulation: 0.6;
    }>;
}>;
