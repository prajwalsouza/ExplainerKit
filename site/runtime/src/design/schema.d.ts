// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Text, at most `max` characters.
 * @param {{max?: number, description?: string}} [options]
 */
export function string({ max, description }?: {
    max?: number;
    description?: string;
}): Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/**
 * A number between `min` and `max`.
 * @param {{min?: number, max?: number, description?: string}} [options]
 */
export function number({ min, max, description }?: {
    min?: number;
    max?: number;
    description?: string;
}): Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/** True or false. @param {{description?: string}} [options] */
export function boolean({ description }?: {
    description?: string;
}): Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/**
 * One of a fixed list of words.
 * @param {string[]} values
 * @param {{description?: string}} [options]
 */
export function oneOf(values: string[], { description }?: {
    description?: string;
}): Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/**
 * A list of items of one shape, with between `min` and `max` entries.
 * @param {any} item
 * @param {{min?: number, max?: number, description?: string}} [options]
 */
export function list(item: any, { min, max, description }?: {
    min?: number;
    max?: number;
    description?: string;
}): Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/**
 * A record with exactly these fields.
 * @param {Record<string, any>} fields
 * @param {{description?: string}} [options]
 */
export function record(fields: Record<string, any>, { description }?: {
    description?: string;
}): Readonly<{
    kind: any;
    json: any;
    check: any;
}>;
/** Problems with `value` against `shape`, as plain sentences; an empty list means it fits. */
export function shapeErrors(s: any, value: any): any[];
/** Return `value` when it fits `shape`; otherwise throw DESIGN_OUTPUT_INVALID with the problems. */
export function expectShape(s: any, value: any, name?: string): any;
/** How far past its stated length a text may run before it is refused. */
export const SLACK: 1.5;
