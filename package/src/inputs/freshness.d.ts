// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Snapshot ages are source-clock-relative; never subtract timestamps across clocks. */
export function fresh(view: any, maximum?: null): any;
/** Earliest freshness expiry, rounded past the inclusive boundary. */
export function freshnessDelay(views: any, maximum?: null): number | null;
