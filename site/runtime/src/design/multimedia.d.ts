// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Audit the shot plan for multimedia principles and measure it; returns the audit, the measures and the problems. */
export function checkMultimedia(run: any, { brief, sections, shots, timing, protect, terms }: {
    brief: any;
    sections: any;
    shots: any;
    timing: any;
    protect?: never[] | undefined;
    terms?: never[] | undefined;
}): Promise<{
    audit: any;
    measures: any;
    problems: any;
}>;
export const MULTIMEDIA_PRINCIPLES: any;
/** Editorial thresholds for the multimedia gate. */
export const MULTIMEDIA_GATE: Readonly<{
    maxElements: 3;
    redundantShare: 0.6;
    redundantMinWords: 5;
    maxTextWords: 12;
    openingSeconds: 60;
    maxUnpaused: 120;
}>;
export const auditMultimedia: Readonly<{
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
export const multimediaMeasures: Readonly<{
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
