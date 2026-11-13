// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** What the attention measures say is wrong, as sentences; an empty list means the script passes the gate. */
export function attentionProblems(measures: any, gate?: Readonly<{
    hookBy: 20;
    maxOpeningCaveats: 0;
    openingSeconds: 60;
    sectionOpeningSeconds: 45;
    maxRecapShare: 0.5;
    low: 20;
    lowFor: 45;
    maxDrought: 240;
    strongEarn: 0.5;
    maxOpenFor: 1800;
    promiseBy: 0.25;
    minAuditDensity: 0.5;
}>): string[];
/**
 * Audit a finished script for attention and measure the ledger; `research` is a research-hooks answer, if any.
 * A script longer than ATTENTION_PART_WORDS is audited part by part (by `chapter` where sections have one), which
 * keeps the reading dense enough to feed the ledger; set `parts` to force either way.
 */
export function auditScriptAttention(run: any, { brief, sections, persona, research, parts }: {
    brief: any;
    sections: any;
    persona?: null | undefined;
    research?: null | undefined;
    parts?: null | undefined;
}): Promise<{
    audit: any;
    measures: any;
    problems: string[];
}>;
/**
 * Plan attention before drafting: research hooks for the brief, then engineer the opening, the refills, the reasons
 * and the promises over `sections`, which are the planned beats or chapters as {beat, narration} (the narration may be
 * a summary of what the beat does).
 */
export function planAttention(run: any, { brief, sections, persona, research }: {
    brief: any;
    sections: any;
    persona?: null | undefined;
    research?: null | undefined;
}): Promise<{
    research: any;
    plan: any;
}>;
/**
 * Audit a finished script for attention and, when the gate finds problems, revise it once with exact line edits.
 * Edits that touch a `protect` line (the main eureka, a planted cue) are dropped. The revision is audited again and
 * kept only when it leaves fewer attention problems. Returns the sections to use, the audits and the pass record.
 */
export function keepAttention(run: any, { brief, sections, persona, research, protect }: {
    brief: any;
    sections: any;
    persona?: null | undefined;
    research?: null | undefined;
    protect?: never[] | undefined;
}): Promise<{
    pass: null;
    audit: any;
    measures: any;
    problems: string[];
    sections: any;
} | {
    before: {
        audit: any;
        measures: any;
        problems: string[];
    };
    pass: {
        problems: string[];
        changes: string[];
        protected: number;
        skipped: number;
        remaining: string[];
        kept: boolean;
    };
    audit: any;
    measures: any;
    problems: string[];
    sections: any;
} | {
    rejected: {
        audit: any;
        measures: any;
        problems: string[];
    };
    pass: {
        problems: string[];
        changes: string[];
        protected: number;
        skipped: number;
        remaining: string[];
        kept: boolean;
    };
    audit: any;
    measures: any;
    problems: string[];
    sections: any;
}>;
/** Kinds of opening hook, after the flavours of motivation 3Blue1Brown names in judging the Summer of Math Exposition. */
export const HOOK_FLAVOURS: readonly string[];
/** Openings of well-made videos, studied from their first ninety seconds of captions; see references.js. */
export const HOOK_REFERENCES: readonly any[];
/** What the reference openings share, as rules the hook operations follow. */
export const HOOK_PATTERNS: readonly string[];
/** What earns patience back. */
export const EARN_KINDS: readonly string[];
/** What spends it. */
export const SPEND_KINDS: readonly string[];
/**
 * The ledger: patience on a 0 to 100 scale. It starts at `start`, drains by `drain` each spoken minute, pays the
 * costs of what the text spends and gains the deposits of what the audit says earned it. Editorial choices.
 */
export const ATTENTION_LEDGER: Readonly<{
    start: 50;
    cap: 100;
    drain: 4;
    wordsPerMinute: 150;
    costs: Readonly<{
        caveat: 4;
        recap: 3;
        term: 3;
        notation: 2;
    }>;
    auditSpend: 10;
    auditEarn: 25;
    question: 2;
}>;
/** Editorial thresholds for the attention gate. Times are spoken seconds. */
export const ATTENTION_GATE: Readonly<{
    hookBy: 20;
    maxOpeningCaveats: 0;
    openingSeconds: 60;
    sectionOpeningSeconds: 45;
    maxRecapShare: 0.5;
    low: 20;
    lowFor: 45;
    maxDrought: 240;
    strongEarn: 0.5;
    maxOpenFor: 1800;
    promiseBy: 0.25;
    minAuditDensity: 0.5;
}>;
export const researchHooks: Readonly<{
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
export const engineerHooks: Readonly<{
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
export const auditAttention: Readonly<{
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
export const attentionMeasures: Readonly<{
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
export const auditAttentionPart: Readonly<{
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
/** Scripts longer than this many words are audited part by part. */
export const ATTENTION_PART_WORDS: 4000;
export const reviseForAttention: Readonly<{
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
