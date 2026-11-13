// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Ordered, inclusive, 1/2/5 decimal ticks. The requested count is approximate. */
export function ticks(domain: any, count?: number): readonly any[];
/** Numeric mapping with explicit unknown input, clamping and inverse semantics. */
export function scale(spec?: {}): (value: any) => any;
/** Fixed category lookup; unknown values never extend the domain or recycle colors. */
export function ordinalScale(spec?: {}): (value: any) => any;
/** Equal-width categorical bands in a fixed numeric range, including reversed ranges. */
export function bandScale(spec?: {}): (value: any) => any;
