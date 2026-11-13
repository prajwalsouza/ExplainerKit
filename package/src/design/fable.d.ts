// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Run the fable process. `brief` is {topic, audience, goals, words}; `seed` fixes the lateral stimuli. */
export function designFable(run: any, brief: any, { seed }?: {
    seed?: number | undefined;
}): Promise<{
    form: string;
    brief: {
        topic: any;
        audience: any;
        goals: any;
        words: any;
    };
    exploration: any;
    seeds: any;
    truth: any;
    research: any;
    allegories: any;
    checks: any;
    allegory: any;
    plot: any;
    draft: any;
    draftMeasures: any;
    reviews: {
        allegory: any;
        craft: any;
    };
    fable: any;
    measures: any;
    title: any;
}>;
export const proposeTruths: Readonly<{
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
export const ALLEGORIES: Readonly<{
    kingdom: "A society living with the problem: a kingdom, a city or a village with its institutions, rituals, experts and excuses. The science arrives as a discovery that changes what the people owe each other. The cost of delay is shown, not argued.";
    'rules-of-magic': "A magical bargain, creature or artefact whose rules are exactly the science. The hero follows the rules literally, and the plot turns on a consequence of the mechanism that nobody expected. The reader learns the rules by watching them bite.";
    'small-fable': "A short fable of a few characters (animals, objects, forces) who each embody one part of the mechanism. It moves fast and ends on a turn the reader works out a moment before it is said, never on a stated moral.";
}>;
export const mapAllegory: Readonly<{
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
export const checkAllegories: Readonly<{
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
export const chooseAllegory: Readonly<{
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
export const plotFable: Readonly<{
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
export const writeFable: Readonly<{
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
export const fableMeasures: Readonly<{
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
export const reviewAllegory: Readonly<{
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
export const reviewFable: Readonly<{
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
export const reviseFable: Readonly<{
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
/** The fable process as stages, for diagrams and documentation; see EXPLAINER_STAGES for the fields. */
export const FABLE_STAGES: readonly ({
    id: string;
    phase: string;
    title: string;
    first: string[];
    parallel: boolean;
    ops: string[];
    variants: {
        wander: string[];
        'map-allegory'?: undefined;
    };
    then: string[];
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    first?: undefined;
    variants?: undefined;
    then?: undefined;
} | {
    id: string;
    phase: string;
    title: string;
    parallel: boolean;
    ops: string[];
    variants: {
        'map-allegory': string[];
        wander?: undefined;
    };
    then: string[];
    first?: undefined;
})[];
