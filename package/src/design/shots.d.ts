// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A medium: its kind, whether sound is available (music, effects, voice), whether images may be generated for the film
 * (`images.generate`) and whether style frames may be generated as previews for the makers (`images.previews`).
 * Generation also needs an image adapter at run time; the medium only says it is allowed.
 */
export function resolveMedium(medium?: {}): Readonly<{
    kind: any;
    sources: any;
    about: any;
    sound: any;
    images: Readonly<{
        generate: any;
        previews: boolean;
    }>;
}>;
/**
 * Time every shot: find its cue in its section's narration and place it in spoken seconds. A shot ends where the next
 * one starts. Returns the timed shots, the total, and errors (a cue not found, shots out of order, a section with no
 * shot at its start) and notes (shots shorter or longer than the gate allows, sources the medium does not allow).
 */
export function timeShots(sections: any, shots: any, { medium, gate }?: {
    medium?: null | undefined;
    gate?: Readonly<{
        wordsPerMinute: 150;
        minSeconds: 2;
        maxSeconds: 45;
    }> | undefined;
}): {
    shots: {
        id: any;
        section: any;
        from: number;
        to: number;
        seconds: number;
    }[];
    seconds: number;
    errors: string[];
    notes: any[];
};
/**
 * Apply patches to a shot plan: each patch is {shot, field, value, why}. Only PATCHABLE fields change, the value must
 * fit the shot shape, and a patch naming an unknown shot is skipped. Returns the new shots and what applied.
 */
export function applyShotPatches(shots: any, patches: any): {
    shots: any;
    applied: any[];
    skipped: any[];
};
/** Decode patch values a model returned as text into the shot field's type. Undecodable values are dropped. */
export function decodePatches(patches: any): any[];
/** A compact view of the shots for prompts: one line of fields per shot, with its timing when known. */
export function shotDigest(shots: any, timing?: null): any;
/**
 * The narration each shot covers: from its cue to the next shot's cue in the same section, or the section's end.
 * Shots whose cue is not found get an empty span.
 */
export function shotSpans(sections: any, shots: any): Map<any, any>;
/** What a medium may put on screen. Motion graphics, drawn by the library, is the default and the optimised case. */
export const MEDIA: Readonly<{
    'motion-graphics': Readonly<{
        sources: readonly string[];
        about: "Everything is drawn and animated by the library: shapes, strokes, text, diagrams, plots, particles, simple characters and camera moves. No photographs, footage or generated images.";
    }>;
    'motion-graphics-with-images': Readonly<{
        sources: readonly string[];
        about: "Drawn motion graphics, plus still images the makers supply or generate (photographs, archival pictures, generated illustrations), animated by the library.";
    }>;
    'generated-video': Readonly<{
        sources: readonly string[];
        about: "Drawn motion graphics and images, plus video clips from a video generator or footage.";
    }>;
}>;
/** What the library can draw, by capability id. Shots name the capabilities they use; code checks them. */
export const VISUAL_VOCABULARY: readonly Readonly<{
    id: string | null;
    from: string | null;
    draws: string | null;
}>[];
/** Rungs of the ladder of abstraction (after Bret Victor) a depiction can sit on. */
export const ABSTRACTIONS: readonly string[];
/** Depiction levels: the plainest picture that communicates, an artful one that stays simple, and a rich one. */
export const DEPICTIONS: readonly string[];
export const FRAMINGS: readonly string[];
export const CAMERA_MOVES: readonly string[];
export const TRANSITIONS: readonly string[];
export const ELEMENT_ROLES: readonly string[];
export const SHOT_PRINCIPLES: any;
export const depictIdeas: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
/** One shot of the plan. Modules patch shots by id through applyShotPatches. */
export const shotShape: Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
export const planShots: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
/** Editorial limits on shot length, in spoken seconds. */
export const SHOT_GATE: Readonly<{
    wordsPerMinute: 150;
    minSeconds: 2;
    maxSeconds: 45;
}>;
export const timeShotsMeasure: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
/** Fields a module may change on a shot. */
export const PATCHABLE: readonly string[];
export const replanShots: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
/** The patch shape modules return. */
export const patchShape: Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/** The narration-suggestion shape visual modules return: exact edits, applied only through the process's gate. */
export const narrationEditShape: Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
export const researchVisuals: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
