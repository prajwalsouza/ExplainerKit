// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** List the terms in a script and check them; `eureka` is {section, line} from the target viewer's audit, if any. */
export function checkTerms(run: any, { brief, sections, persona, eureka }: {
    brief: any;
    sections: any;
    persona?: null | undefined;
    eureka?: null | undefined;
}): Promise<{
    terms: any;
    measures: any;
}>;
/**
 * Apply line edits to sections: each `find` is located in its section (exactly, or by the closest sentence) and
 * replaced. Returns the new sections and which edits applied; an edit whose words cannot be found is skipped.
 */
export function applyEdits(sections: any, edits: any): {
    sections: any;
    applied: any[];
    skipped: number;
};
/** Editorial thresholds: how many sections a term may go unsaid before it needs its picture again. */
export const TERMS_GATE: Readonly<{
    maxGap: 3;
}>;
export const findTerms: Readonly<{
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
export const termMeasures: Readonly<{
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
export const rewritePlain: Readonly<{
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
