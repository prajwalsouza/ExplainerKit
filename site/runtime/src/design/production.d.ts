// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * A labelled image prompt in the layout Codex's image generation guidance recommends: use case, asset type, request,
 * scene, subject, style, composition, mood, palette, exact text, constraints and what to avoid. Empty lines are left
 * out.
 */
export function imagePromptSpec(p: any): string;
/**
 * Put a style into an image prompt: its look leads the style line and its avoid list joins the prompt's, so every
 * image follows the house style whatever the prompt-writing model wrote.
 */
export function withStyle(prompt: any, style: any): any;
/**
 * Generate images through the caller's `imager`, one call per prompt, recording each result or error. When a
 * `reviewer` is given, a function ({file, spec, previewsOnly}) => Promise<{fits, problems}>, each image is checked
 * against its prompt: whether it shows the idea it was asked for, whether it would mislead, and whether it follows the
 * style. Generated images are a model's work and often miss the one thing the frame was for.
 */
export function generateImages(imager: any, prompts: any, { limit, reviewer, previewsOnly }?: {
    limit?: number | undefined;
    reviewer?: null | undefined;
    previewsOnly?: boolean | undefined;
}): Promise<{
    id: any;
    shot: any;
    kind: any;
    file: any;
    ok: boolean;
}[]>;
/**
 * Run the visual design process on a finished script. `medium` is a medium name or object (motion graphics by
 * default). `protect` lists lines no narration edit may touch (the eureka, planted cues). Narration edits proposed by
 * the visual modules are applied only when `recheck` is given: a function (run, sections) => Promise<problems[]>,
 * usually the attention audit, whose problem count must not rise above `baseline`. Without it the edits are returned
 * as suggestions. `imager` enables image generation when the medium allows it. `rounds` bounds the loop.
 * @param {any} run
 * @param {{brief: any, sections: Array<{beat?: string, narration: string, chapter?: string}>, medium?: any, persona?: any, protect?: string[], terms?: string[], attention?: any, recheck?: ((run: any, sections: any[]) => Promise<string[]>) | null, baseline?: number | null, imager?: ((request: {id: string, kind: string, prompt: string}) => Promise<{file: string | null}>) | null, reviewer?: ((request: {file: string, spec: string, previewsOnly: boolean}) => Promise<{fits: boolean | null, problems: string[]}>) | null, style?: any, rounds?: number, research?: boolean}} options
 */
export function designVisuals(run: any, { brief, sections, medium, persona, protect, terms, attention, recheck, baseline, imager, reviewer, style, rounds, research, }?: {
    brief: any;
    sections: Array<{
        beat?: string;
        narration: string;
        chapter?: string;
    }>;
    medium?: any;
    persona?: any;
    protect?: string[];
    terms?: string[];
    attention?: any;
    recheck?: ((run: any, sections: any[]) => Promise<string[]>) | null;
    baseline?: number | null;
    imager?: ((request: {
        id: string;
        kind: string;
        prompt: string;
    }) => Promise<{
        file: string | null;
    }>) | null;
    reviewer?: ((request: {
        file: string;
        spec: string;
        previewsOnly: boolean;
    }) => Promise<{
        fits: boolean | null;
        problems: string[];
    }>) | null;
    style?: any;
    rounds?: number;
    research?: boolean;
}): Promise<{
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
}>;
export const PRODUCTION_PRINCIPLES: any;
/** The image-prompt use cases Codex's image tool recognises that suit explainers. */
export const IMAGE_USE_CASES: readonly string[];
export const writeImagePrompts: Readonly<{
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
/** The visual design stages, for diagrams and documentation. */
export const VISUAL_STAGES: readonly ({
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
})[];
/** Principles of the production process as prompt rules, for operations that plan production work. */
export const PRODUCTION_RULES: any;
export const PRODUCTION_EXAMPLES: any;
