// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Design the visual structure for a shot plan and measure it. `attention` is an attention-measures result, if any. */
export function planStructure(run: any, { brief, sections, shots, timing, attention }: {
    brief: any;
    sections: any;
    shots: any;
    timing: any;
    attention?: null | undefined;
}): Promise<{
    structure: any;
    measures: any;
    problems: any;
}>;
/** Bruce Block's visual components. */
export const VISUAL_COMPONENTS: readonly string[];
export const CINEMATOGRAPHY_PRINCIPLES: any;
/** Editorial thresholds for the structure gate. */
export const STRUCTURE_GATE: Readonly<{
    framingRun: 4;
    minContrast: 0.12;
    lowIntensity: 0.4;
    maxCutsPerMinute: 12;
}>;
export const designStructure: Readonly<{
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
export const structureMeasures: Readonly<{
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
