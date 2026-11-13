import { assert, number, options } from '../core/validate.js';
import { attachMedia } from '../media/index.js';
import { encodeWav } from './mix.js';
import { capturePCM } from './pcm.js';

/** Audition one offline PCM soundtrack through the existing media-owned picture clock.
 * @param {any} player
 * @param {{sampleRate:number,channels:ReadonlyArray<Float32Array|Float64Array|readonly number[]>,duration?:number,metadata?:any,clippedSamples?:number}} input
 * @param {{document?:Document,offset?:number,volume?:number,muted?:boolean,reducedMotion?:'respect'|'audio-only',onError?:(error:any)=>void}} [spec]
 */
export function attachSoundtrack(player, input, spec = {}) {
  options(spec, ['document', 'offset', 'volume', 'muted', 'reducedMotion', 'onError'], 'soundtrack playback');
  assert(
    player && !player.disposed && typeof player.on === 'function' && typeof player.reportError === 'function',
    'INVALID_PLAYER',
    'Attach sound to a live ExplainerKit player.',
  );
  const motion = spec.reducedMotion ?? 'audio-only';
  assert(
    ['respect', 'audio-only'].includes(motion),
    'INVALID_REDUCED_MOTION',
    'Sound motion policy is respect or audio-only.',
  );
  const volume = number(spec.volume ?? 1, 'sound volume', 0, 1),
    offset = number(spec.offset ?? 0, 'sound offset', 0, 86400),
    muted = spec.muted ?? false;
  assert(typeof muted === 'boolean', 'SOUND_PLAYBACK', 'muted must be boolean.');
  assert(
    spec.onError === undefined || typeof spec.onError === 'function',
    'SOUND_PLAYBACK',
    'onError must be a function.',
  );
  const doc = spec.document ?? player.element?.ownerDocument ?? globalThis.document,
    host = doc?.defaultView ?? globalThis,
    urlAPI = host.URL ?? globalThis.URL,
    BlobType = host.Blob ?? globalThis.Blob;
  assert(
    doc &&
      typeof doc.createElement === 'function' &&
      typeof urlAPI?.createObjectURL === 'function' &&
      typeof urlAPI?.revokeObjectURL === 'function' &&
      typeof BlobType === 'function',
    'SOUND_UNSUPPORTED',
    'Sound playback requires a browser document and Blob URLs.',
  );
  // Validate and capture before constructing any resource; no synthesis or scheduling callbacks run here.
  const pcm = capturePCM(input),
    bytes = encodeWav({ sampleRate: pcm.sampleRate, channels: pcm.channels }),
    url = urlAPI.createObjectURL(new BlobType([bytes], { type: 'audio/wav' }));
  let media = null,
    driver = null,
    disposed = false,
    lastError = null;
  const removers = [];
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    const errors = [],
      attempt = (fn) => {
        try {
          fn();
        } catch (error) {
          errors.push(error);
        }
      };
    for (const remove of removers.splice(0)) attempt(remove);
    attempt(() => driver?.dispose());
    if (media) {
      attempt(() => media.pause());
      attempt(() => media.removeAttribute?.('src'));
      attempt(() => media.load?.());
      attempt(() => media.remove?.());
    }
    attempt(() => urlAPI.revokeObjectURL(url));
    if (errors.length)
      lastError = Object.assign(new Error('Some owned sound resources refused cleanup.'), {
        code: 'SOUND_CLEANUP',
        causes: errors,
      });
  };
  try {
    media = doc.createElement('audio');
    media.preload = 'auto';
    media.autoplay = false;
    media.loop = false;
    media.volume = volume;
    media.muted = muted;
    media.src = url;
    const initial = number(player.time ?? 0, 'sound player time', 0, 86400) + offset;
    number(initial, 'sound initial seek', 0, 86400);
    media.currentTime = initial;
    driver = attachMedia(player, media, {
      offset,
      reducedMotion: motion,
      onError: (error) => {
        lastError = error;
        if (spec.onError) spec.onError(error);
        else player.reportError(error);
      },
    });
    removers.push(
      player.on('dispose', cleanup),
      player.on('driver', (next) => {
        if (next !== 'media') cleanup();
      }),
    );
  } catch (error) {
    cleanup();
    throw error;
  }
  const live = () => assert(!disposed && !driver.disposed, 'DISPOSED', 'This soundtrack playback adapter is disposed.');
  return Object.freeze({
    get media() {
      return media;
    },
    get disposed() {
      return disposed || driver.disposed;
    },
    get error() {
      return lastError;
    },
    get playing() {
      return !disposed && !media.paused && !media.ended;
    },
    get reducedMotion() {
      return motion;
    },
    get volume() {
      return media.volume;
    },
    set volume(value) {
      live();
      media.volume = number(value, 'sound volume', 0, 1);
    },
    get muted() {
      return media.muted;
    },
    set muted(value) {
      live();
      assert(typeof value === 'boolean', 'SOUND_PLAYBACK', 'muted must be boolean.');
      media.muted = value;
    },
    get speed() {
      return media.playbackRate;
    },
    set speed(value) {
      live();
      const before = lastError;
      player.speed = number(value, 'sound playback speed', 0.1, 16);
      if (lastError !== before && lastError?.code === 'MEDIA_RATE_REJECTED') throw lastError;
    },
    async play() {
      live();
      await driver.play();
    },
    pause() {
      live();
      driver.pause();
    },
    seek(time) {
      live();
      driver.seek(time);
    },
    refresh() {
      live();
      driver.refresh();
    },
    dispose: cleanup,
  });
}
