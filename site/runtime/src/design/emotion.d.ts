// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Design and measure the emotional layer of a shot plan. */
export function planEmotion(run: any, { brief, sections, shots, timing, structure }: {
    brief: any;
    sections: any;
    shots: any;
    timing: any;
    structure: any;
}): Promise<{
    emotion: any;
    measures: any;
    problems: any;
}>;
/** Charles Forceville's kinds of visual metaphor, plus none. */
export const METAPHOR_TYPES: readonly string[];
/** Don Norman's three levels at which a design is felt. */
export const FEELING_LEVELS: readonly string[];
export const EMOTION_PRINCIPLES: any;
/** Editorial thresholds for the emotion gate. */
export const EMOTION_GATE: Readonly<{
    openingSeconds: 60;
    minAgentShare: 0.15;
    maxHumour: 0.2;
}>;
export const designEmotion: Readonly<{
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
export const emotionMeasures: Readonly<{
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
