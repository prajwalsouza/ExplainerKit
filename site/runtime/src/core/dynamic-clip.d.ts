// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function captureHandleClip(scene: any, input: any, source?: null): {
    input: any;
    target: any;
    present: boolean;
};
export function commitHandleClip(record: any, captured: any, initial?: boolean): void;
export function clearHandleClip(record: any): void;
export function validateClipAdoption(parent: any, child: any): void;
/** Resolve using one sampled frame only: no seek history, author callbacks or live handles in output. */
export function resolveDynamicClips(frame: any): any;
export function dynamicClipId(record: any): any;
