// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Where a quoted line sits in `text`, as [from, to] character offsets, or null. Tries the exact words, then the words
 * with quotes and spacing folded, then the sentence sharing at least 60% of the quote's words; a quote the model
 * paraphrased too far is not found.
 */
export function locateQuote(text: any, quote: any): number[] | null;
/**
 * Surprise as it lands: for each section, the line the audit quoted, where it falls through the whole script (0 to 1,
 * by characters), and its surprise relative to this script's own range (0 its flattest moment, 1 its strongest), so a
 * script is read against itself rather than against an absolute score.
 */
export function surpriseMoments(sections: any, audit: any): any;
/**
 * Read the eureka graph from an audit: each eureka cites the earlier sections (and eurekas) it comes from, and may cite
 * its own section as the trigger. Returns how many eurekas there are, the main one and how many earlier sections feed
 * it, the depth of the longest chain of eurekas citing eurekas, the sections before the main eureka that feed nothing,
 * and citations that point forward or nowhere.
 */
export function eurekaGraph(audit: any, count: any): {
    eurekas: any;
    main: {
        id: any;
        section: any;
        sources: any;
    } | null;
    depth: number;
    loose: number[];
    errors: string[];
};
/** Engineer the cascade on a chosen telling; returns the engineered telling and its check. */
export function engineerInsight(run: any, context: any, telling: any, { known }?: {
    known?: never[] | undefined;
}): Promise<{
    telling: any;
    check: any;
}>;
/** Audit a finished script for insight; `cues` are the engineered cues, if any. */
export function auditScriptInsight(run: any, { brief, sections, cues, persona }: {
    brief: any;
    sections: any;
    cues?: never[] | undefined;
    persona?: null | undefined;
}): Promise<{
    audit: any;
    measures: any;
}>;
/** What the insight measures say is wrong, as sentences; an empty list means the script passes the gate. */
export function insightProblems(measures: any, cues?: any[], gate?: Readonly<{
    earliestAha: 0.55;
    longestFlat: 4;
    minStrongSurprises: 2;
    minVerifiedShare: 0.5;
    minSources: 2;
    maxLostLines: 1;
}>): string[];
export const engineerCascade: Readonly<{
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
export const checkCascade: Readonly<{
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
export const auditInsight: Readonly<{
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
export const insightMeasures: Readonly<{
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
/** The insight gate: when the audit and its measures call for a restructuring pass. Editorial thresholds. */
export const INSIGHT_GATE: Readonly<{
    earliestAha: 0.55;
    longestFlat: 4;
    minStrongSurprises: 2;
    minVerifiedShare: 0.5;
    minSources: 2;
    maxLostLines: 1;
}>;
export const reviseForInsight: Readonly<{
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
