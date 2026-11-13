// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Consult philosophy on a chosen story. `input` is {brief, story, depth}, where depth is a reframing ladder (optional).
 * Returns the mapped debates, the verdict on the leap and its check.
 */
export function consultPhilosophy(run: any, { brief, story, depth }: {
    brief: any;
    story: any;
    depth?: never[] | undefined;
}): Promise<{
    debates: any;
    verdict: any;
    check: any;
    debate: any;
}>;
export const INVITATIONS: readonly string[];
export const mapDebates: Readonly<{
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
export const weighLeap: Readonly<{
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
export const checkPhilosophy: Readonly<{
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
