// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A kit of synthesized drums, hits and noise gestures. Pitches not in the map are silent. */
export function percussionInstrument(settings?: {}): Readonly<{
    kind: any;
    name: any;
    release: any;
    cost: any;
    range: readonly number[];
}>;
/** Sounds a percussion kit can map to a MIDI pitch. */
export const PERCUSSION_SOUNDS: readonly string[];
/** The default kit. Each pitch plays one sound, with `tune` in semitones. */
export const PERCUSSION_KIT: Readonly<{
    35: Readonly<{
        sound: "sub";
    }>;
    36: Readonly<{
        sound: "boom";
    }>;
    37: Readonly<{
        sound: "rim";
    }>;
    38: Readonly<{
        sound: "frame";
    }>;
    41: Readonly<{
        sound: "taiko";
        tune: -5;
    }>;
    43: Readonly<{
        sound: "taiko";
        tune: -2;
    }>;
    45: Readonly<{
        sound: "taiko";
        tune: 2;
    }>;
    47: Readonly<{
        sound: "taiko";
        tune: 6;
    }>;
    42: Readonly<{
        sound: "tick";
    }>;
    44: Readonly<{
        sound: "shaker";
    }>;
    49: Readonly<{
        sound: "swell";
    }>;
    52: Readonly<{
        sound: "riser";
    }>;
    53: Readonly<{
        sound: "fall";
    }>;
}>;
