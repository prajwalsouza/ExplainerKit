import { assert, number, options } from '../core/validate.js';
const playerOwners = new WeakMap(),
  mediaOwners = new WeakMap();
/** Media is the time authority. No integration or accumulated drift correction.
 * @param {any} player
 * @param {HTMLMediaElement|any} media
 * @param {{offset?:number,onError?:(error:any)=>void,reducedMotion?:'respect'|'audio-only'}} [spec]
 */
export function attachMedia(player, media, spec = {}) {
  options(spec, ['offset', 'onError', 'reducedMotion'], 'media driver');
  const offset = number(spec.offset ?? 0, 'media offset', 0, 86400),
    onError = spec.onError ?? ((e) => player.reportError(e)),
    motion = spec.reducedMotion ?? 'respect';
  assert(
    ['respect', 'audio-only'].includes(motion),
    'INVALID_REDUCED_MOTION',
    'Media reducedMotion is respect or audio-only.',
  );
  assert(
    player &&
      !player.disposed &&
      ['syncTime', 'setDriver', 'seek', 'pause', 'on'].every((k) => typeof player[k] === 'function'),
    'INVALID_PLAYER',
    'Use a live player with media synchronization.',
  );
  assert(
    media &&
      ['play', 'pause', 'addEventListener', 'removeEventListener'].every((k) => typeof media[k] === 'function') &&
      Number.isFinite(media.currentTime),
    'INVALID_MEDIA',
    'Provide an HTMLMediaElement.',
  );
  assert(typeof onError === 'function', 'INVALID_MEDIA', 'onError must be a function.');
  assert(
    !playerOwners.has(player) && !mediaOwners.has(media),
    'MEDIA_OWNED',
    'Detach the existing media driver first.',
  );
  const host = media.ownerDocument?.defaultView ?? globalThis;
  assert(
    typeof host.requestAnimationFrame === 'function',
    'UNSUPPORTED_BROWSER',
    'Media synchronization needs animation frames.',
  );
  let disposed = false,
    request = null,
    syncing = false;
  const removers = [],
    originalRate = media.playbackRate;
  const listen = (target, name, fn) => {
    target.addEventListener(name, fn);
    removers.push(() => target.removeEventListener(name, fn));
  };
  const fail = (error) => {
    if (disposed) return;
    cancel();
    syncing = true;
    try {
      media.pause();
      player.pause();
    } finally {
      syncing = false;
    }
    onError(error);
  };
  function cancel() {
    if (request !== null) host.cancelAnimationFrame(request);
    request = null;
  }
  function schedule() {
    if (!disposed && request === null && !media.paused && !media.ended) request = host.requestAnimationFrame(tick);
  }
  function sync() {
    if (disposed || syncing) return;
    syncing = true;
    try {
      if (player.reducedMotion && motion === 'respect' && !media.paused) media.pause();
      const time = Math.max(
        0,
        Math.min(player.duration, number(media.currentTime, 'media currentTime', 0, 86400) - offset),
      );
      if (!(player.reducedMotion && motion === 'audio-only'))
        player.syncTime(time, { source: 'media', playing: !media.paused && !media.ended && time < player.duration });
      if (time >= player.duration && !media.paused) media.pause();
    } finally {
      syncing = false;
    }
  }
  function tick() {
    request = null;
    try {
      sync();
      schedule();
    } catch (error) {
      fail(error);
    }
  }
  function changed() {
    try {
      sync();
      schedule();
    } catch (error) {
      fail(error);
    }
  }
  function paused() {
    cancel();
    changed();
  }
  function requestedPause(reason) {
    if (motion === 'audio-only' && reason?.reason === 'reduced-motion') return;
    if (!syncing && !disposed) {
      cancel();
      media.pause();
    }
  }
  function seek(time) {
    if (!syncing && !disposed) {
      media.currentTime = number(time + offset, 'media seek', 0, 86400);
      changed();
    }
  }
  async function play() {
    assert(!disposed, 'DISPOSED', 'The media driver is disposed.');
    if (player.reducedMotion && motion === 'respect') {
      player.play();
      return;
    }
    try {
      await media.play();
      if (disposed) {
        media.pause();
        return;
      }
      changed();
    } catch (cause) {
      const error = Object.assign(new Error('Media playback was rejected; activate playback from a user gesture.'), {
        code: 'MEDIA_PLAY_REJECTED',
        cause,
      });
      fail(error);
      throw error;
    }
  }
  function dispose(release = true) {
    if (disposed) return;
    disposed = true;
    cancel();
    for (const remove of removers.splice(0)) remove();
    playerOwners.delete(player);
    mediaOwners.delete(media);
    try {
      media.pause();
    } finally {
      try {
        media.playbackRate = originalRate;
      } finally {
        if (release && !player.disposed && player.driver === 'media') player.setDriver(null);
      }
    }
  }
  player.setDriver('media');
  assert(
    !player.disposed && player.driver === 'media',
    'DRIVER_OWNED',
    'Player ownership changed while attaching media.',
  );
  try {
    playerOwners.set(player, true);
    mediaOwners.set(media, true);
    removers.push(
      player.on('requestPlay', () => {
        void play().catch(() => {});
      }),
      player.on('pause', requestedPause),
      player.on('seek', seek),
      player.on('rate', (value) => {
        if (!syncing) {
          const previous = media.playbackRate;
          try {
            media.playbackRate = value;
          } catch (cause) {
            const error = Object.assign(new Error('The native media element refused this playback rate.'), {
              code: 'MEDIA_RATE_REJECTED',
              cause,
            });
            syncing = true;
            try {
              player.speed = previous;
            } catch (rollback) {
              error.rollbackError = rollback;
            } finally {
              syncing = false;
            }
            fail(error);
          }
        }
      }),
      player.on('dispose', () => dispose(false)),
      player.on('driver', (value) => {
        if (value !== 'media') dispose(false);
      }),
    );
    listen(media, 'play', changed);
    listen(media, 'playing', changed);
    listen(media, 'pause', paused);
    listen(media, 'ended', paused);
    listen(media, 'seeked', changed);
    listen(media, 'timeupdate', changed);
    listen(media, 'loadedmetadata', changed);
    listen(media, 'ratechange', () => {
      if (syncing) return;
      syncing = true;
      try {
        player.speed = number(media.playbackRate, 'media playback rate', 0.1, 16);
      } catch (e) {
        fail(e);
      } finally {
        syncing = false;
      }
    });
    listen(media, 'error', () =>
      fail(Object.assign(new Error(media.error?.message ?? 'Media loading failed.'), { code: 'MEDIA_ERROR' })),
    );
    player.speed = number(media.playbackRate, 'media playback rate', 0.1, 16);
    sync();
    schedule();
  } catch (error) {
    dispose();
    throw error;
  }
  return Object.freeze({
    get disposed() {
      return disposed;
    },
    get media() {
      return media;
    },
    play,
    pause() {
      media.pause();
      paused();
    },
    seek(time) {
      player.seek(time);
    },
    refresh: changed,
    dispose,
  });
}
