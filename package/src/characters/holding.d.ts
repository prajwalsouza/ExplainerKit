// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Internal lifecycle preflight for glyph attachment; history before the claim remains seekable. */
export function prepareHoldAttachment(handle: any, from: any, until: any): () => void;
/** A world-space prop attachment implemented through the existing sampled-effect boundary. */
export function holdProp(scene: any, actor: any, handle: any, socket: any, spec?: {}): Readonly<{
    handle: any;
    from: any;
    to: any;
    dispose(): void;
}>;
