import { assert } from '../core/validate.js';

const hosts = new WeakMap();
/** One browser request for all native timeline clocks sharing a host. Internal. */
export function sharedFrameHost(host) {
  assert(
    host && (typeof host === 'object' || typeof host === 'function'),
    'UNSUPPORTED_BROWSER',
    'Provide a frame host.',
  );
  assert(
    typeof host.requestAnimationFrame === 'function' && typeof host.cancelAnimationFrame === 'function',
    'UNSUPPORTED_BROWSER',
    'Playback needs animation-frame scheduling.',
  );
  if (hosts.has(host)) return hosts.get(host);
  const jobs = new Map();
  let next = 0,
    request = null,
    flushing = false;
  function schedule() {
    if (request === null && jobs.size) request = host.requestAnimationFrame(flush);
  }
  function flush(stamp) {
    request = null;
    flushing = true;
    const failures = [];
    for (const id of [...jobs.keys()]) {
      const callback = jobs.get(id);
      if (!callback) continue;
      jobs.delete(id);
      try {
        callback(stamp);
      } catch (cause) {
        failures.push(cause);
      }
    }
    flushing = false;
    schedule();
    // Like independent browser callbacks, one failure must not starve peers.
    if (failures.length) throw new AggregateError(failures, 'Native frame callbacks failed.');
  }
  const shared = Object.freeze({
    requestAnimationFrame(callback) {
      assert(typeof callback === 'function', 'INVALID_CALLBACK', 'A frame callback must be a function.');
      assert(jobs.size < 4096, 'RESOURCE_LIMIT', 'Use at most 4096 pending native frame callbacks per host.');
      const id = ++next;
      jobs.set(id, callback);
      if (!flushing) schedule();
      return id;
    },
    cancelAnimationFrame(id) {
      jobs.delete(id);
      if (!jobs.size && request !== null) {
        host.cancelAnimationFrame(request);
        request = null;
      }
    },
    matchMedia: host.matchMedia ? (query) => host.matchMedia(query) : undefined,
    performance: host.performance,
  });
  hosts.set(host, shared);
  return shared;
}
