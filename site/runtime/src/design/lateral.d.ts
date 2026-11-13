// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Run the lateral operations together on a brief; returns their outputs keyed by kind. */
export function lateralPass(run: any, brief: any, { seed }?: {
    seed?: number | undefined;
}): Promise<{
    reframings: any;
    provocations: any;
    randomEntries: any;
    distantLinks: any;
    frames: any;
    paradox: any;
    wanderings: any;
}>;
/**
 * Run the reframing loop on a focus question. Each round picks fresh lens families, reframes, drops repeated frames,
 * reads the literature and chooses the deepest connected question, which becomes the next focus. Returns the ladder
 * of chosen questions (concrete to deep) and every frame and reading.
 */
export function reframeLoop(run: any, { brief, focus }: {
    brief: any;
    focus: any;
}, { rounds, seed }?: {
    rounds?: number | undefined;
    seed?: number | undefined;
}): Promise<{
    ladder: any[];
    frames: any[];
    readings: any[];
}>;
export const LENSES: readonly string[][];
export const reframe: Readonly<{
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
export const PROVOCATIONS: readonly string[][];
export const provoke: Readonly<{
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
/** Concrete, unrelated words for random entry. Ordinary objects work better than abstractions. */
export const STIMULI: readonly string[];
/** Fields far from most science topics, for bisociation. */
export const FAR_FIELDS: readonly string[];
export const pickStimuli: Readonly<{
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
export const randomEntry: Readonly<{
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
export const connectDistant: Readonly<{
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
export const createFrames: Readonly<{
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
export const findImage: Readonly<{
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
export const wander: Readonly<{
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
export const keepWanderings: Readonly<{
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
export const LENS_FAMILIES: readonly string[][];
export const pickLenses: Readonly<{
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
export const deepenFrame: Readonly<{
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
export const freshFrames: Readonly<{
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
export const readAround: Readonly<{
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
export const chooseDepth: Readonly<{
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
