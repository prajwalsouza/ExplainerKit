// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Internal bounded additive-effect installation; callbacks return final transform values. */
export function installHandleEffect(handle: any, owner: any, patchFn: any): () => void;
export function applyHandleEffects(record: any, props: any, context: any): void;
/** Synchronous query scope, used to measure other effects while excluding one effect family. */
export function withoutHandleEffects(predicate: any, sample: any): any;
