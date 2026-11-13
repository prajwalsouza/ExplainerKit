// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** The target persona of an audience, or its first one. */
export function targetPersona(personas: any): any;
/** Audit a finished script once per persona; each audit reads as that viewer and may honestly find no eureka. */
export function auditForAudience(run: any, { brief, sections, cues, personas }: {
    brief: any;
    sections: any;
    cues?: never[] | undefined;
    personas: any;
}): Promise<{
    readings: any;
    summary: any;
}>;
/** What the audience comparison says is wrong, as sentences; an empty list means the eureka lands for everyone. */
export function audienceProblems(summary: any): string[];
/** Mastery levels, from someone meeting the topic for the first time to someone who teaches it. */
export const AUDIENCE_LEVELS: readonly string[];
export const persona: Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
export const buildAudience: Readonly<{
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
export const audienceInsight: Readonly<{
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
