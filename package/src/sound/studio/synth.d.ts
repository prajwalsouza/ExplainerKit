// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Subtractive and FM synthesizer. A patch is plain data, so it can be stored,
 * varied and shared. Oscillators are band-limited, and the filter keeps its
 * tuning while its cutoff moves.
 */
export function synthInstrument(patchInput?: {}): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
/** Starting patches for documentary scoring. Spread one into `synthInstrument` and change any field. */
export const SYNTH_PATCHES: Readonly<{
    warmPad: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            level: number;
            octave?: undefined;
        } | {
            wave: string;
            octave: number;
            level: number;
            unison?: undefined;
            detune?: undefined;
            spread?: undefined;
        })[];
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            envelope: number;
            dynamics: number;
            lfo: number;
        };
        filterEnvelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        lfo: {
            rate: number;
        };
        drift: number;
        velocity: number;
    };
    glassPad: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            octave?: undefined;
            level?: undefined;
        } | {
            wave: string;
            octave: number;
            level: number;
            unison: number;
            detune: number;
            spread?: undefined;
        } | {
            wave: string;
            octave: number;
            level: number;
            unison?: undefined;
            detune?: undefined;
            spread?: undefined;
        })[];
        fm: {
            ratio: number;
            index: number;
            decay: number;
            sustain: number;
        };
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            dynamics: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        drift: number;
        velocity: number;
        gain: number;
    };
    airPad: {
        name: string;
        oscillators: ({
            wave: string;
            level: number;
            unison?: undefined;
            detune?: undefined;
        } | {
            wave: string;
            level: number;
            unison: number;
            detune: number;
        })[];
        filter: {
            mode: string;
            slope: number;
            cutoff: number;
            resonance: number;
            keyTrack: number;
            dynamics: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        velocity: number;
        gain: number;
    };
    choir: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            pulseWidth?: undefined;
            level?: undefined;
        } | {
            wave: string;
            pulseWidth: number;
            level: number;
            unison: number;
            detune: number;
            spread?: undefined;
        })[];
        noise: number;
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            dynamics: number;
        };
        formant: {
            vowel: string;
            mix: number;
            q: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        lfo: {
            rate: number;
            delay: number;
            fade: number;
        };
        vibrato: number;
        drift: number;
        velocity: number;
        gain: number;
    };
    synthStrings: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            octave?: undefined;
            level?: undefined;
        } | {
            wave: string;
            octave: number;
            level: number;
            unison: number;
            detune: number;
            spread?: undefined;
        })[];
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            envelope: number;
            dynamics: number;
        };
        filterEnvelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        lfo: {
            rate: number;
            delay: number;
            fade: number;
        };
        vibrato: number;
        drift: number;
        velocity: number;
    };
    brass: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            pulseWidth?: undefined;
            level?: undefined;
        } | {
            wave: string;
            pulseWidth: number;
            level: number;
            unison?: undefined;
            detune?: undefined;
            spread?: undefined;
        })[];
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            envelope: number;
            velocity: number;
            dynamics: number;
        };
        filterEnvelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        lfo: {
            rate: number;
            delay: number;
            fade: number;
        };
        vibrato: number;
        drift: number;
    };
    subBass: {
        name: string;
        oscillators: ({
            wave: string;
            level?: undefined;
        } | {
            wave: string;
            level: number;
        })[];
        filter: {
            cutoff: number;
            slope: number;
            resonance: number;
            keyTrack: number;
            dynamics: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        drive: number;
        retrigger: boolean;
        velocity: number;
        width: number;
        gain: number;
    };
    deepBass: {
        name: string;
        oscillators: ({
            wave: string;
            level: number;
            pulseWidth?: undefined;
        } | {
            wave: string;
            pulseWidth: number;
            level: number;
        })[];
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            envelope: number;
            velocity: number;
            dynamics: number;
        };
        filterEnvelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        drive: number;
        retrigger: boolean;
        width: number;
    };
    pulse: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            pulseWidth?: undefined;
            level?: undefined;
        } | {
            wave: string;
            pulseWidth: number;
            level: number;
            unison?: undefined;
            detune?: undefined;
            spread?: undefined;
        })[];
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            envelope: number;
            velocity: number;
            dynamics: number;
        };
        filterEnvelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        velocity: number;
        gain: number;
    };
    softLead: {
        name: string;
        oscillators: ({
            wave: string;
            unison: number;
            detune: number;
            spread: number;
            octave?: undefined;
            level?: undefined;
        } | {
            wave: string;
            octave: number;
            level: number;
            unison?: undefined;
            detune?: undefined;
            spread?: undefined;
        })[];
        filter: {
            cutoff: number;
            resonance: number;
            keyTrack: number;
            dynamics: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        lfo: {
            rate: number;
            delay: number;
            fade: number;
        };
        vibrato: number;
    };
    bell: {
        name: string;
        oscillators: ({
            wave: string;
            octave?: undefined;
            cents?: undefined;
            level?: undefined;
        } | {
            wave: string;
            octave: number;
            cents: number;
            level: number;
        })[];
        fm: {
            ratio: number;
            index: number;
            decay: number;
            sustain: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        velocity: number;
    };
    electricPiano: {
        name: string;
        oscillators: {
            wave: string;
            unison: number;
            detune: number;
            spread: number;
        }[];
        fm: {
            ratio: number;
            index: number;
            decay: number;
            sustain: number;
        };
        envelope: {
            attack: number;
            decay: number;
            sustain: number;
            release: number;
        };
        lfo: {
            rate: number;
        };
        tremolo: number;
        velocity: number;
    };
}>;
