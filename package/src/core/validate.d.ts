// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function assert(condition: any, code: any, message: any): void;
export function number(value: any, name: any, min?: number, max?: number): any;
export function text(value: any, name: any, max?: number): any;
/** JSON-like values only. Descriptors are checked before reading; no user getters run. */
export function safeCopy(value: any, depth?: number, budget?: {
    count: number;
}): any;
export function options(value: any, allowed: any, name?: string): void;
/** Errors carry stable codes. Messages explain how to repair the authored input. */
export class KitError extends Error {
    constructor(code: any, message: any);
    code: any;
}
