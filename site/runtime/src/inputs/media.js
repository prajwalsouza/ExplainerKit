import { assert, number, options, safeCopy, KitError } from '../core/validate.js';
import { managedSource } from './source.js';

const SOURCE_KEYS = ['id', 'unit', 'space', 'maxSamples', 'maxBytes', 'maxAge', 'clock'];
const stopTracks = (stream) => {
  for (const track of stream?.getTracks?.() ?? [])
    try {
      track.stop();
    } catch {
      /* Finish releasing other owned tracks. */
    }
};
const unsupported = (message) => new KitError('INPUT_UNSUPPORTED', message);
function settings(spec, kind) {
  options(
    spec,
    [
      ...SOURCE_KEYS,
      'environment',
      'constraints',
      'fps',
      ...(kind === 'microphone' ? ['fftSize', 'clippingThreshold', 'bands', 'bandRange', 'waveform'] : []),
    ],
    kind + ' input',
  );
  const constraints = spec.constraints === undefined ? true : safeCopy(spec.constraints);
  assert(
    typeof constraints === 'boolean' || (constraints && typeof constraints === 'object' && !Array.isArray(constraints)),
    'INVALID_INPUT_MEDIA',
    'Use boolean or bounded native media constraints.',
  );
  if (typeof constraints === 'object') {
    const keys =
      kind === 'camera'
        ? ['deviceId', 'groupId', 'width', 'height', 'aspectRatio', 'frameRate', 'facingMode', 'resizeMode']
        : [
            'deviceId',
            'groupId',
            'sampleRate',
            'sampleSize',
            'channelCount',
            'echoCancellation',
            'noiseSuppression',
            'autoGainControl',
            'latency',
          ];
    options(constraints, keys, 'media constraints');
    let count = 0;
    const inspect = (value, depth = 0) => {
      assert(
        ++count <= 128 && depth <= 2,
        'RESOURCE_LIMIT',
        'Media constraints exceed the bounded native descriptor budget.',
      );
      if (value && typeof value === 'object') {
        assert(!Array.isArray(value) || value.length <= 8, 'RESOURCE_LIMIT', 'Constraint alternatives exceed8 values.');
        if (!Array.isArray(value)) options(value, ['ideal', 'exact', 'min', 'max'], 'native constraint');
        for (const v of Object.values(value)) inspect(v, depth + 1);
      } else if (typeof value === 'number') number(value, 'media constraint', 0, 1e7);
      else
        assert(
          typeof value === 'boolean' || (typeof value === 'string' && value.length <= 256),
          'INVALID_INPUT_MEDIA',
          'Use native scalar constraint values.',
        );
    };
    for (const value of Object.values(constraints)) inspect(value);
  }
  const fps = number(spec.fps ?? 30, 'media input rate', 1, 60),
    source = {
      kind: 'state',
      unit: kind === 'camera' ? 'frame' : 'normalized amplitude',
      space: kind === 'camera' ? 'camera' : 'audio',
    };
  for (const key of SOURCE_KEYS) if (spec[key] !== undefined) source[key] = spec[key];
  return { constraints, fps, source, environment: spec.environment };
}
function loop(environment, ctx, rate, callback, video) {
  const frameMode =
    video &&
    typeof video.requestVideoFrameCallback === 'function' &&
    typeof video.cancelVideoFrameCallback === 'function';
  let token = null,
    dead = false,
    last = -Infinity;
  const schedule = () => {
    if (dead || !ctx.isCurrent()) return;
    token = frameMode ? video.requestVideoFrameCallback(tick) : environment.requestAnimationFrame(tick);
  };
  const tick = (_stamp, metadata) => {
    token = null;
    if (dead || !ctx.isCurrent()) return;
    try {
      const now = ctx.now();
      if (now - last >= 1 / rate - 1e-9) {
        last = now;
        callback(metadata);
      }
      schedule();
    } catch (error) {
      dead = true;
      ctx.status('error', error);
    }
  };
  if (
    !frameMode &&
    !(typeof environment.requestAnimationFrame === 'function' && typeof environment.cancelAnimationFrame === 'function')
  )
    throw unsupported('Live media needs video frame callbacks or requestAnimationFrame.');
  schedule();
  return () => {
    dead = true;
    if (token !== null) {
      if (frameMode) video.cancelVideoFrameCallback(token);
      else environment.cancelAnimationFrame(token);
      token = null;
    }
  };
}
function environmentAtStart(config) {
  return config.environment ?? globalThis;
}
function endedListener(stream, cleanup, ctx) {
  const records = [];
  for (const track of stream.getTracks()) {
    const ended = () => {
      cleanup();
      if (ctx.isCurrent()) ctx.status('interrupted', new KitError('INPUT_ENDED', 'An owned media track ended.'));
    };
    track.addEventListener?.('ended', ended);
    records.push([track, ended]);
  }
  return () => {
    for (const [track, fn] of records) track.removeEventListener?.('ended', fn);
  };
}

/** Capture camera metadata after explicit start; the caller supplies the visible preview element. */
export function cameraInput(video, spec = {}) {
  const config = settings(spec, 'camera');
  assert(video && typeof video === 'object', 'INVALID_INPUT_MEDIA', 'Supply a visible video preview element.');
  return managedSource(config.source, async (ctx) => {
    if (!ctx.isCurrent()) return () => {};
    const env = environmentAtStart(config),
      get = env.navigator?.mediaDevices?.getUserMedia;
    if (typeof get !== 'function') throw unsupported('Camera capture is unavailable.');
    let stream = null,
      restore = null,
      cancel = () => {},
      unlisten = () => {},
      dead = false;
    const cleanup = () => {
      if (dead) return;
      dead = true;
      ctx.signal.removeEventListener('abort', cleanup);
      try {
        cancel();
      } catch {
        /* Continue cleanup after platform cancellation errors. */
      }
      unlisten();
      if (restore) {
        try {
          restore();
        } catch {
          /* Tracks still release if preview restoration fails. */
        }
      }
      stopTracks(stream);
    };
    ctx.signal.addEventListener('abort', cleanup, { once: true });
    try {
      stream = await get.call(env.navigator.mediaDevices, { video: config.constraints, audio: false });
      if (dead || !ctx.isCurrent()) {
        stopTracks(stream);
        return cleanup;
      }
      const previous = video.srcObject;
      video.srcObject = stream;
      restore = () => {
        if (video.srcObject === stream) video.srcObject = previous;
      };
      unlisten = endedListener(stream, cleanup, ctx);
      if (stream.getTracks().some((track) => track.readyState === 'ended')) {
        cleanup();
        throw new KitError('INPUT_ENDED', 'Camera track ended before preview.');
      }
      if (typeof video.play === 'function') await video.play();
      if (dead || !ctx.isCurrent()) {
        cleanup();
        return cleanup;
      }
      let frames = 0;
      cancel = loop(
        env,
        ctx,
        config.fps,
        (metadata) => {
          if (video.srcObject !== stream) {
            ctx.status(
              'interrupted',
              new KitError('INPUT_PREVIEW_REPLACED', 'The camera preview source was replaced.'),
            );
            return;
          }
          const width = Number(video.videoWidth),
            height = Number(video.videoHeight);
          if (!(width > 0 && height > 0 && width <= 32768 && height <= 32768)) return;
          const mediaTime = metadata?.mediaTime ?? video.currentTime ?? 0;
          if (!Number.isFinite(mediaTime) || mediaTime < 0) return;
          ctx.emit({ width, height, mediaTime, frames: ++frames }, { time: ctx.now(), valid: true });
        },
        video,
      );
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });
}

/**
 * Microphone level windows: RMS, peak and clipping; with `bands`, also a coarse spectrum. No speech
 * recognition, recording or audio feedback path.
 */
export function microphoneInput(spec = {}) {
  const config = settings(spec, 'microphone'),
    fftSize = number(spec.fftSize ?? 1024, 'microphone window', 32, 32768),
    threshold = number(spec.clippingThreshold ?? 0.99, 'clipping threshold', 0.01, 1),
    bandCount = number(spec.bands ?? 0, 'microphone bands', 0, 64),
    waveCount = number(spec.waveform ?? 0, 'microphone waveform points', 0, 1024),
    range = spec.bandRange ?? [60, 8000];
  assert(
    Number.isInteger(fftSize) && Number.isInteger(Math.log2(fftSize)),
    'INVALID_INPUT_MEDIA',
    'Microphone window must be a power of two.',
  );
  assert(Number.isInteger(bandCount), 'INVALID_INPUT_MEDIA', 'Microphone bands must be a whole number from 0 to 64.');
  assert(
    Number.isInteger(waveCount),
    'INVALID_INPUT_MEDIA',
    'Microphone waveform points must be a whole number from 0 to 1024.',
  );
  assert(Array.isArray(range) && range.length === 2, 'INVALID_INPUT_MEDIA', 'bandRange must be [low, high] in hertz.');
  const low = number(range[0], 'band range low', 1, 48000),
    high = number(range[1], 'band range high', 2, 96000);
  assert(high > low, 'INVALID_INPUT_MEDIA', 'bandRange high must exceed low.');
  return managedSource(config.source, async (ctx) => {
    if (!ctx.isCurrent()) return () => {};
    const env = environmentAtStart(config),
      get = env.navigator?.mediaDevices?.getUserMedia,
      Context = env.AudioContext ?? env.webkitAudioContext;
    if (typeof get !== 'function' || typeof Context !== 'function')
      throw unsupported('Microphone capture and AudioContext are required.');
    let stream = null,
      audio = null,
      input = null,
      analyser = null,
      cancel = () => {},
      unlisten = () => {},
      dead = false;
    const cleanup = () => {
      if (dead) return;
      dead = true;
      ctx.signal.removeEventListener('abort', cleanup);
      try {
        cancel();
      } catch {
        /* Continue cleanup after platform cancellation errors. */
      }
      unlisten();
      try {
        input?.disconnect();
      } catch {
        /* Release remaining resources. */
      }
      try {
        analyser?.disconnect();
      } catch {
        /* Release remaining resources. */
      }
      try {
        Promise.resolve(audio?.close()).catch(() => {});
      } catch {
        /* Tracks must stop even when close fails. */
      }
      stopTracks(stream);
    };
    ctx.signal.addEventListener('abort', cleanup, { once: true });
    try {
      stream = await get.call(env.navigator.mediaDevices, { audio: config.constraints, video: false });
      if (dead || !ctx.isCurrent()) {
        stopTracks(stream);
        return cleanup;
      }
      unlisten = endedListener(stream, cleanup, ctx);
      if (stream.getTracks().some((track) => track.readyState === 'ended')) {
        cleanup();
        throw new KitError('INPUT_ENDED', 'Microphone track ended before analysis.');
      }
      audio = new Context();
      analyser = audio.createAnalyser();
      analyser.fftSize = fftSize;
      input = audio.createMediaStreamSource(stream);
      input.connect(analyser);
      await audio.resume();
      if (dead || !ctx.isCurrent()) {
        cleanup();
        return cleanup;
      }
      const data = new Float32Array(fftSize),
        spectrum = bandCount ? new Float32Array(analyser.frequencyBinCount ?? fftSize / 2) : null;
      // Log-spaced bands between the range's ends (clamped to Nyquist): the mean of each band's bins,
      // mapped from the analyser's decibel range to 0–1.
      const edges = bandCount
        ? Array.from({ length: bandCount + 1 }, (_, i) => {
            const nyquist = audio.sampleRate / 2,
              hi = Math.min(high, nyquist),
              lo = Math.min(low, hi / 2),
              hz = lo * (hi / lo) ** (i / bandCount);
            return Math.min(spectrum.length, Math.max(0, Math.round((hz / nyquist) * spectrum.length)));
          })
        : null;
      const floor = analyser.minDecibels ?? -100,
        ceiling = analyser.maxDecibels ?? -30;
      cancel = loop(env, ctx, config.fps, () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0,
          peak = 0,
          clippedSamples = 0;
        for (const value of data) {
          if (!Number.isFinite(value)) {
            ctx.emit(null, { time: ctx.now(), valid: false });
            return;
          }
          sum += value * value;
          peak = Math.max(peak, Math.abs(value));
          if (Math.abs(value) >= threshold) clippedSamples++;
        }
        // The waveform: the window in `waveform` buckets, each the sample of largest magnitude (sign kept),
        // so peaks survive the downsampling.
        let waveform;
        if (waveCount) {
          waveform = new Array(Math.min(waveCount, data.length));
          const per = data.length / waveform.length;
          for (let w = 0; w < waveform.length; w++) {
            let best = 0;
            for (let k = Math.floor(w * per); k < Math.floor((w + 1) * per); k++)
              if (Math.abs(data[k]) > Math.abs(best)) best = data[k];
            waveform[w] = Math.max(-1, Math.min(1, best));
          }
        }
        let bands;
        if (spectrum) {
          analyser.getFloatFrequencyData(spectrum);
          bands = edges.slice(0, -1).map((from, i) => {
            const to = Math.max(from + 1, edges[i + 1]);
            let total = 0,
              count = 0;
            for (let k = from; k < Math.min(to, spectrum.length); k++) {
              const db = spectrum[k];
              total += Number.isFinite(db) ? Math.max(0, Math.min(1, (db - floor) / (ceiling - floor))) : 0;
              count++;
            }
            return count ? total / count : 0;
          });
        }
        ctx.emit(
          {
            rms: Math.sqrt(sum / data.length),
            peak,
            clippedSamples,
            clippedShare: clippedSamples / data.length,
            sampleRate: audio.sampleRate,
            windowSamples: data.length,
            ...(bands ? { bands } : {}),
            ...(waveform ? { waveform } : {}),
          },
          { time: ctx.now(), valid: true },
        );
      });
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });
}
