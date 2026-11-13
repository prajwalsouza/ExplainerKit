import { encodeWav } from '../../runtime/src/sound/mix.js';
import { playInstrument } from '../../runtime/src/sound/studio/index.js';
import { rule } from './music-figures.js';

export const RATE = 44100;

/**
 * Render notes of one instrument into a stereo buffer. Each note is
 * `[start seconds, pitch, duration seconds, velocity]`.
 */
export function phrase(instrument, notes, seconds) {
  const frames = Math.round(seconds * RATE),
    left = new Float32Array(frames),
    right = new Float32Array(frames);
  for (const [start, pitch, duration, velocity] of notes) {
    const note = playInstrument(instrument, pitch, { duration, velocity, sampleRate: RATE, seed: Math.round(start * 100) + 1 });
    const offset = Math.round(start * RATE),
      length = Math.min(note.channels[0].length, frames - offset);
    for (let i = 0; i < length; i++) {
      left[offset + i] += note.channels[0][i];
      right[offset + i] += note.channels[1][i];
    }
  }
  return { sampleRate: RATE, channels: [left, right] };
}

/** Lowest and highest sample in each of `columns` equal spans of a channel. */
export function envelope(channel, columns) {
  return Array.from({ length: columns }, (_, index) => {
    let low = 0,
      high = 0;
    const end = Math.floor(((index + 1) * channel.length) / columns);
    for (let i = Math.floor((index * channel.length) / columns); i < end; i++) {
      if (channel[i] < low) low = channel[i];
      if (channel[i] > high) high = channel[i];
    }
    return [low, high];
  });
}

/** Draw a waveform row centred on `y`, scaled so `scale` reaches `height` pixels. */
export function drawWave(drawing, channel, { left, right, y, height, scale, stroke, columns }) {
  const step = (right - left) / (columns - 1);
  for (const [index, [low, high]] of envelope(channel, columns).entries()) {
    const x = left + index * step,
      top = Math.max(-1, Math.min(1, high / scale)),
      bottom = Math.max(-1, Math.min(1, low / scale));
    if (top - bottom < 0.01) continue;
    rule(drawing, x, y - top * height, x, y - bottom * height, stroke);
  }
}

/** Keep one audio element playing the latest PCM. Returns a setter and a cleanup function. */
export function player(audio) {
  let url = null;
  return {
    set(pcm) {
      const wave = encodeWav({ channels: pcm.channels, sampleRate: pcm.sampleRate });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([wave], { type: 'audio/wav' }));
      audio.pause();
      audio.src = url;
    },
    dispose() {
      if (url) URL.revokeObjectURL(url);
    },
  };
}

/** Scale a buffer so its largest sample is `peak`. Returns a new buffer. */
export function normalized(pcm, peak = 0.89) {
  let most = 1e-9;
  for (const channel of pcm.channels) for (let i = 0; i < channel.length; i++) most = Math.max(most, Math.abs(channel[i]));
  return { sampleRate: pcm.sampleRate, channels: pcm.channels.map((channel) => channel.map((value) => (value * peak) / most)) };
}
