// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Compact what discovery found for one subtopic, so later steps read summaries, not whole dossiers. */
export function summariseDiscovery(found: any): {
    topic: any;
    objectives: any;
    seed: any;
    insight: any;
    deepQuestion: any;
    mechanism: any;
    ideas: any;
    people: any;
    parallels: any;
    image: any;
    meaning: any;
};
/** Share of the material the filtering agent kept; below `min`, the piece is likely to read as a lecture. */
export function keepRatio(decisions: any, { min }?: {
    min?: number | undefined;
}): {
    kept: any;
    of: any;
    ratio: number;
    tooFew: boolean;
};
/** Names and proper nouns for each cut item, for checkCuts. */
export function cutNames(found: any, cutIds: any): {
    id: any;
    names: any[];
}[];
/**
 * Write a long piece chapter by chapter, in parallel, then bridge the chapters and plant the callbacks. A weak model
 * writes a good chapter far more reliably than a good long script in one go.
 */
export function writeChapters(run: any, whole: any, outline: any, { moves, medium, style, imager, reviewer, visuals: withVisuals, }?: {
    moves?: null | undefined;
    medium?: string | undefined;
    style?: undefined;
    imager?: null | undefined;
    reviewer?: null | undefined;
    visuals?: boolean | undefined;
}): Promise<{
    chapters: any;
    joins: any;
    visuals: {
        medium: Readonly<{
            kind: any;
            sources: any;
            about: any;
            sound: any;
            images: Readonly<{
                generate: any;
                previews: boolean;
            }>;
        }>;
        research: any;
        ideas: any;
        shots: any;
        timing: {
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
        structure: any;
        look: any;
        emotion: any;
        motion: any;
        sound: any;
        multimedia: {
            audit: any;
        };
        measures: {
            look: any;
            sound: any;
            multimedia: any;
            structure: any;
            emotion: any;
            motion: any;
        };
        sections: {
            beat?: string;
            narration: string;
            chapter?: string;
        }[];
        rounds: {
            round: number;
            lostShots: any;
            proposed: number;
            protected: number;
            applied: number;
            kept: boolean;
        }[];
        production: {
            storyboard: any;
            animatic: {
                shot: any;
                section: any;
                from: number;
                to: number;
                seconds: number;
                says: any;
            }[];
            colourScript: any;
            styleFrames: any;
            prompts: any;
            images: {
                id: any;
                shot: any;
                kind: any;
                file: any;
                ok: boolean;
            }[];
            imagesNote: string | null;
        };
        problems: any[];
    } | null;
    attention: {
        research: any;
        plan: any;
        audit: any;
        measures: any;
        problems: string[];
        pass: {
            problems: string[];
            changes: string[];
            protected: number;
            skipped: number;
            remaining: string[];
            kept: boolean;
        } | null;
    };
    script: {
        sections: any[];
    };
    measures: any;
    title: any;
}>;
/**
 * Run the series process. `brief` has `topics` (a list of subtopic phrases) or `objectives` (learning objectives),
 * plus `audience`, `goals` and `minutes` for the whole. Returns the discovery for each subtopic, the cohesion
 * assessment, the stitched outline and its checks, and the written piece or episodes (unless not feasible).
 */
export function designSeries(run: any, brief: any, { seed, moves, imager, reviewer, visuals }?: {
    seed?: number | undefined;
    moves?: null | undefined;
    imager?: null | undefined;
    reviewer?: null | undefined;
    visuals?: boolean | undefined;
}): Promise<{
    form: string;
    objectives: any;
    subtopics: any;
    discoveries: any;
    cohesionMap: any;
    assessment: any;
}>;
export const planSubtopics: Readonly<{
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
export const coverObjectives: Readonly<{
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
export const cohesionMap: Readonly<{
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
export const assessCohesion: Readonly<{
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
export const stitch: Readonly<{
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
export const checkStitch: Readonly<{
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
/**
 * Did cut material come back in the written script? Looks for the names of cut people and the proper nouns of cut
 * stories in the narration.
 */
export const checkCuts: Readonly<{
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
export const bridgeChapters: Readonly<{
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
/**
 * The series process as stages, for diagrams and documentation; see EXPLAINER_STAGES for the fields. `each` says a
 * stage runs once per subtopic or chapter, all of them at the same time.
 */
export const SERIES_STAGES: readonly ({
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when?: undefined;
    loop?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when: {
        'design-sound': string;
        'sound-measures': string;
        'replan-shots'?: undefined;
        'write-image-prompts'?: undefined;
    };
    loop?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    loop: number;
    when: {
        'replan-shots': string;
        'design-sound'?: undefined;
        'sound-measures'?: undefined;
        'write-image-prompts'?: undefined;
    };
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when: {
        'write-image-prompts': string;
        'design-sound'?: undefined;
        'sound-measures'?: undefined;
        'replan-shots'?: undefined;
    };
    loop?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when: {
        'plan-subtopics': string;
        'cover-objectives': string;
        'polish-voice'?: undefined;
        'revise-for-attention'?: undefined;
    };
    each?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    each: string;
    ops: string[];
    when?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    each: string;
    ops: string[];
    when: {
        'polish-voice': string;
        'plan-subtopics'?: undefined;
        'cover-objectives'?: undefined;
        'revise-for-attention'?: undefined;
    };
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when: {
        'revise-for-attention': string;
        'plan-subtopics'?: undefined;
        'cover-objectives'?: undefined;
        'polish-voice'?: undefined;
    };
    each?: undefined;
})[];
