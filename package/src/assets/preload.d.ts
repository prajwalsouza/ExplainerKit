// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Bounded first-party fetch queue. Construction is inert; start/updateAct opts in. */
export function preload(input: any, spec?: {}): Readonly<{
    acts: any;
    readonly status: Readonly<{
        disposed: boolean;
        act: any;
        bytes: number;
        maxBytes: any;
        active: number;
        assets: readonly any[];
    }>;
    start: (value?: number) => Promise<any>;
    updateAct: (value?: number) => Promise<any>;
    settled: () => Promise<any>;
    retry: (id: any) => Promise<any>;
    get: (id: any) => any;
    dispose: () => void;
}>;
