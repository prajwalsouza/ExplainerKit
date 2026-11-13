// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Attention policy over measured CSS-pixel boxes. It never changes marks or authored time. */
export function planAnnotations(input: any, spec: any): Readonly<{
    status: "ready" | "needsAttention";
    visible: readonly any[];
    deferred: readonly any[];
    diagnostics: readonly any[];
    metrics: Readonly<{
        required: any;
        placedRequired: number;
        essentialCoverage: number;
        optional: number;
        placedOptional: number;
        deferredOptional: number;
        total: any;
        dwellWindowVerified: boolean;
        unverifiedAssociations: number;
    }>;
    next: readonly Readonly<{
        id: any;
        placement: any;
    }>[];
}>;
