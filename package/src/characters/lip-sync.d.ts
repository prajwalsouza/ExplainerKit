// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Import Rhubarb's documented JSON mouth-cue protocol. This reads timing data only: it never
 * opens metadata.soundFile, runs an executable or claims to recognize phonemes itself.
 * Protocol: https://github.com/DanielSWolf/rhubarb-lip-sync#json-format-json
 */
export function speechFromRhubarb(input: any, spec?: {}): Readonly<{
    source: string;
    at: any;
    end: any;
    cues: any;
    words: readonly never[];
    sample(time: any): Readonly<{
        [k: string]: any;
    }> | null;
}>;
