// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Plucked string from a filtered delay loop. The loop length sets the pitch,
 * its filter sets how fast the upper partials fade, and the pick position
 * removes the partials that have a node where the string is plucked.
 */
export function pluckedInstrument(settings?: {}): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
/** A tuned percussion instrument made from decaying partials, each a two-pole resonator. */
export function modalInstrument(settings?: {}): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
/** Plucked-string starting points. `decay` is the ring time in seconds at middle C. */
export const PLUCKED_PRESETS: Readonly<{
    harp: Readonly<{
        decay: 5.5;
        brightness: 0.52;
        pick: 0.32;
        body: number[];
        release: 1.6;
        ring: true;
    }>;
    nylon: Readonly<{
        decay: 3.2;
        brightness: 0.45;
        pick: 0.2;
        body: number[];
        release: 0.25;
        ring: false;
    }>;
    pizzicato: Readonly<{
        decay: 0.75;
        brightness: 0.3;
        pick: 0.14;
        body: number[];
        release: 0.2;
        ring: true;
    }>;
    zither: Readonly<{
        decay: 4.5;
        brightness: 0.85;
        pick: 0.09;
        body: number[];
        release: 1;
        ring: true;
    }>;
}>;
/**
 * Struck bars, bells and bowls. Each entry lists partials as
 * `[frequency ratio, level, decay scale]`. `decay` is the ring time at middle C.
 */
export const MODAL_PRESETS: Readonly<{
    celesta: Readonly<{
        decay: 2.6;
        modes: number[][];
        strike: 0.25;
        ring: true;
    }>;
    glockenspiel: Readonly<{
        decay: 3.4;
        modes: number[][];
        strike: 0.4;
        ring: true;
    }>;
    vibraphone: Readonly<{
        decay: 6;
        modes: number[][];
        strike: 0.12;
        ring: false;
        tremolo: number[];
    }>;
    marimba: Readonly<{
        decay: 1.1;
        modes: number[][];
        strike: 0.3;
        ring: true;
    }>;
    kalimba: Readonly<{
        decay: 2.2;
        modes: number[][];
        strike: 0.5;
        ring: true;
    }>;
    musicBox: Readonly<{
        decay: 3;
        modes: number[][];
        strike: 0.6;
        ring: true;
    }>;
    tubularBell: Readonly<{
        decay: 9;
        modes: number[][];
        strike: 0.2;
        ring: true;
    }>;
    bowl: Readonly<{
        decay: 14;
        modes: number[][];
        strike: 0.05;
        ring: true;
        gain: -4;
    }>;
}>;
