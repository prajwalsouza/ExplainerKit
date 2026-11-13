// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Atomically project fresh observations into the scene's existing numeric parameters. */
export function bindInputs(scene: any, sources: any, mappings: any, spec?: {}): Readonly<{
    flush: () => boolean;
    dispose: () => void;
    snapshot: () => any;
}>;
/** Replace an existing scene DataSource only after a complete mapped row set validates. */
export function bindData(data: any, source: any, spec?: {}): Readonly<{
    flush: () => boolean;
    dispose: () => void;
    snapshot: () => any;
}>;
