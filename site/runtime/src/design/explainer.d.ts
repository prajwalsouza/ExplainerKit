// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** What the measures say is wrong with the voice. `runs` are the choppy passages found by shortRuns. */
export function voiceProblems(measures: any, gate?: Readonly<{
    maxHedgesPer100Words: 2.2;
    minSentenceSpread: 7;
    maxInstructionShare: 0.08;
    minNarratorPer100Words: 1;
    maxShortRuns: 2;
}>, runs?: any[]): string[];
/**
 * The discovery stage: explore, think laterally, choose a story, and research it (people, mechanism, parallels,
 * backward plan, meaning, central image). Everything a writer needs, before any structure is chosen.
 */
export function discoverExplainer(run: any, brief: any, { seed, depthRounds }?: {
    seed?: number | undefined;
    depthRounds?: number | undefined;
}): Promise<{
    brief: {
        objectives?: any;
        topic: any;
        audience: any;
        goals: any;
        minutes: any;
    };
    audience: any;
    exploration: any;
    seeds: any;
    seed: any;
    depth: {
        topic: any;
        story: any;
    };
    story: {
        seed: any;
        editor: {
            why: any;
            protect: any;
        };
    };
    people: any;
    parallels: any;
    research: any;
    plan: any;
    philosophy: any;
    meaning: any;
    image: any;
}>;
/**
 * The writing stage: tellings in every shape, structure and flow checks, the draft, three reviews, revision and
 * the voice gate, then the title. `found` is what discovery returned (or what a series stitched together).
 */
export function writeExplainer(run: any, found: any, { moves, insightPasses, medium, imager, reviewer, style, visuals: withVisuals, }?: {
    moves?: null | undefined;
    insightPasses?: number | undefined;
    medium?: string | undefined;
    imager?: null | undefined;
    reviewer?: null | undefined;
    style?: undefined;
    visuals?: boolean | undefined;
}): Promise<{
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
    tellings: any;
    checks: any;
    cascade: {
        telling: any;
        check: any;
    };
    telling: any;
    insight: {
        audit: any;
        measures: any;
    } | {
        audit: any;
        measures: any;
        persona: any;
    };
    viewers: {
        readings: any;
        summary: any;
    } | null;
    terms: {
        terms: any;
        measures: any;
    };
    insightPass: {
        kind: string;
        problems: any[];
        changes: string[];
        skipped: number;
        remaining: any[];
        kept: boolean;
    } | {
        kind: string;
        problems: any[];
        changes: any;
        remaining: any[];
        kept: boolean;
        skipped?: undefined;
    } | null;
    insightPasses: ({
        kind: string;
        problems: any[];
        changes: string[];
        skipped: number;
        remaining: any[];
        kept: boolean;
    } | {
        kind: string;
        problems: any[];
        changes: any;
        remaining: any[];
        kept: boolean;
        skipped?: undefined;
    })[];
    draft: any;
    draftMeasures: any;
    reviews: {
        science: any;
        learning: any;
        story: any;
    };
    voiceGate: string[];
    script: any;
    measures: any;
    title: any;
}>;
/**
 * Run the explainer process: discovery, then writing. `brief` is {topic, audience, goals, minutes}; `seed` fixes
 * the lateral stimuli; `moves` are optional writing techniques passed to the telling and drafting steps as examples.
 */
export function designExplainer(run: any, brief: any, { seed, moves, imager, reviewer, visuals }?: {
    seed?: number | undefined;
    moves?: null | undefined;
    imager?: null | undefined;
    reviewer?: null | undefined;
    visuals?: boolean | undefined;
}): Promise<{
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
    tellings: any;
    checks: any;
    cascade: {
        telling: any;
        check: any;
    };
    telling: any;
    insight: {
        audit: any;
        measures: any;
    } | {
        audit: any;
        measures: any;
        persona: any;
    };
    viewers: {
        readings: any;
        summary: any;
    } | null;
    terms: {
        terms: any;
        measures: any;
    };
    insightPass: {
        kind: string;
        problems: any[];
        changes: string[];
        skipped: number;
        remaining: any[];
        kept: boolean;
    } | {
        kind: string;
        problems: any[];
        changes: any;
        remaining: any[];
        kept: boolean;
        skipped?: undefined;
    } | null;
    insightPasses: ({
        kind: string;
        problems: any[];
        changes: string[];
        skipped: number;
        remaining: any[];
        kept: boolean;
    } | {
        kind: string;
        problems: any[];
        changes: any;
        remaining: any[];
        kept: boolean;
        skipped?: undefined;
    })[];
    draft: any;
    draftMeasures: any;
    reviews: {
        science: any;
        learning: any;
        story: any;
    };
    voiceGate: string[];
    script: any;
    measures: any;
    title: any;
    brief: {
        objectives?: any;
        topic: any;
        audience: any;
        goals: any;
        minutes: any;
    };
    audience: any;
    exploration: any;
    seeds: any;
    seed: any;
    depth: {
        topic: any;
        story: any;
    };
    story: {
        seed: any;
        editor: {
            why: any;
            protect: any;
        };
    };
    people: any;
    parallels: any;
    research: any;
    plan: any;
    philosophy: any;
    meaning: any;
    image: any;
    form: string;
}>;
export const SHAPES: Readonly<{
    mystery: "A mystery with a reveal. Open with a question the audience cannot answer yet. Plant the pieces of the answer earlier, each as its own interesting moment, disguised so they do not give the ending away. At the reveal, several earlier moments should click into place together.";
    chain: "A chain of parallel stories. Open on something everyone agrees about, then pull the rug with the deep question. Step sideways through the parallels (near, then middle, then far), each one answering a little and handing on a bigger question, with a dose of play between them. Return to the opening at the end with a question larger and more human than the first.";
    descent: "A descent and return. Pose one concrete question with real numbers. Build the explanation piece by piece, each piece a small surprise or a playful aside, down to the formal level (a formula, a rule, a precise statement), then decode that formal statement so every symbol means something seen earlier. Climb back up: where else the idea appears, and what it says about how we know things.";
    experience: "An experience first. Begin with something the audience can see, try or feel right now. Change one condition at a time and let them notice the difference before you explain it. Then use the explanation on a new case they did not expect.";
}>;
export const developTelling: Readonly<{
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
export const checkTellings: Readonly<{
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
export const chooseTelling: Readonly<{
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
export const draftScript: Readonly<{
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
export const scriptMeasures: Readonly<{
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
export const revise: Readonly<{
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
/** The voice gate: which measures say the script needs a voice pass. Editorial thresholds, from the reference scripts. */
export const VOICE_GATE: Readonly<{
    maxHedgesPer100Words: 2.2;
    minSentenceSpread: 7;
    maxInstructionShare: 0.08;
    minNarratorPer100Words: 1;
    maxShortRuns: 2;
}>;
export const DEFAULT_AUDIENCE: "curious adults with no specialist knowledge";
/**
 * The explainer process as stages, in order, for diagrams and documentation; the process itself is designExplainer.
 * A stage runs `first` in order, then `ops` (in parallel when `parallel` is true), then `then` in order. `variants`
 * names the parallel copies of one operation; `when` marks a conditional step. `phase` groups stages for display:
 * discover, research, shape, write or refine.
 */
export const EXPLAINER_STAGES: readonly ({
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
    loop: number;
    ops: string[];
    first?: undefined;
    variants?: undefined;
    then?: undefined;
    when?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    first: string[];
    parallel: boolean;
    ops: string[];
    variants: {
        wander: string[];
        'develop-telling'?: undefined;
    };
    then: string[];
    loop?: undefined;
    when?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    first: string[];
    parallel: boolean;
    ops: string[];
    loop?: undefined;
    variants?: undefined;
    then?: undefined;
    when?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    variants: {
        'develop-telling': string[];
        wander?: undefined;
    };
    then: string[];
    loop?: undefined;
    first?: undefined;
    when?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when: {
        'polish-voice': string;
        'rewrite-plain'?: undefined;
        'revise-for-insight'?: undefined;
        'audit-attention-part'?: undefined;
        'revise-for-attention'?: undefined;
    };
    loop?: undefined;
    first?: undefined;
    variants?: undefined;
    then?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    loop: number;
    when: {
        'rewrite-plain': string;
        'revise-for-insight': string;
        'polish-voice'?: undefined;
        'audit-attention-part'?: undefined;
        'revise-for-attention'?: undefined;
    };
    first?: undefined;
    variants?: undefined;
    then?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    when: {
        'audit-attention-part': string;
        'revise-for-attention': string;
        'polish-voice'?: undefined;
        'rewrite-plain'?: undefined;
        'revise-for-insight'?: undefined;
    };
    loop?: undefined;
    first?: undefined;
    variants?: undefined;
    then?: undefined;
})[];
