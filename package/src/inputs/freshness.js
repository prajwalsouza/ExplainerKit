/** Snapshot ages are source-clock-relative; never subtract timestamps across clocks. */
export function fresh(view, maximum = null) {
  return (
    view.status === 'running' && !view.stale && view.latest?.quality.valid && (maximum === null || view.age <= maximum)
  );
}
/** Earliest freshness expiry, rounded past the inclusive boundary. */
export function freshnessDelay(views, maximum = null) {
  if (!views.every((view) => fresh(view, maximum))) return null;
  return Math.max(
    1,
    Math.ceil(Math.min(...views.map((view) => (Math.min(view.maxAge, maximum ?? view.maxAge) - view.age) * 1000))) + 1,
  );
}
