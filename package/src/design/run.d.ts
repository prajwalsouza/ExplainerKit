// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Declare one design operation. Model operations take `role`, `purpose`, `method` (steps), optional `examples`
 * and `rules`, an `output` shape, and whether the model may `search` the web. Measures take `compute(input)`.
 */
export function defineOperation(spec: any): Readonly<{
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
/** The full prompt text for a model operation and its input. */
export function renderPrompt(operation: any, input: any, extra?: {}): string;
/**
 * A design run. `model` is required for model operations; it returns `{output, usage}`, where usage (optional)
 * counts tokens as {input, cachedInput, output, reasoning}. `recorder` (optional) has `save(entry)` and may have
 * `load(label)` returning an earlier entry, which is reused when its input is unchanged.
 * @param {{model?: (request: any) => Promise<{output: any, usage?: any}>, recorder?: {save: (entry: any) => any, load?: (label: string) => any}, effort?: string, onStep?: (step: {label: string, status: string, ms?: number}) => void}} [options]
 */
export function createDesignRun({ model, recorder, effort, onStep }?: {
    model?: (request: any) => Promise<{
        output: any;
        usage?: any;
    }>;
    recorder?: {
        save: (entry: any) => any;
        load?: (label: string) => any;
    };
    effort?: string;
    onStep?: (step: {
        label: string;
        status: string;
        ms?: number;
    }) => void;
}): Readonly<{
    call: (operation: any, input?: {}, options?: {}) => Promise<any>;
    /** Run several calls at once; same as Promise.all, named so a process reads as a flowchart. */
    all: (calls: any) => Promise<any[]>;
    scope: (prefix: any) => Readonly<{
        call: (operation: any, input: any, options?: {}) => Promise<any>;
        all: (calls: any) => Promise<any[]>;
        scope: (inner: any) => Readonly</*elided*/ any>;
    }>;
    readonly trace: any[];
    /** Tokens used by model calls made in this run (reused steps are not counted). */
    readonly usage: {};
}>;
export const OPERATION_KINDS: readonly string[];
export const EFFORTS: readonly string[];
