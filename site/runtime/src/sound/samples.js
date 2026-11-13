import { assert, number, options, text } from '../core/validate.js';
import { capturePCM, result, allocate, dense, fades, scalePeak, peakOf, sampleRate } from './pcm.js';
import { midiPitch } from './instruments.js';

const sampleBankRates = new WeakMap();

export function sampleBankRate(bank) {
  return sampleBankRates.get(bank);
}

function bounds(value, defaultValue, name) {
  const values = dense(value ?? defaultValue, name, 2);
  assert(values.length === 2, 'SOUND_ZONE', 'A sample zone range needs two endpoints.');
  number(values[0], name, 0, name === 'velocity range' ? 1 : 127);
  number(values[1], name, values[0], name === 'velocity range' ? 1 : 127);
  return values;
}
/** Captured caller-owned licensed PCM with explicit pitch/velocity zones; no network or implicit assets. */
export function sampleInstrument(input, spec = {}) {
  options(spec, ['name', 'sampleRate'], 'sample instrument');
  const name = text(spec.name ?? 'caller sample bank', 'sample bank name', 200),
    rate = sampleRate(spec.sampleRate),
    ids = new Set();
  let total = 0;
  const zones = dense(input, 'sample zones', 128).map((zone, index) => {
    options(zone, ['id', 'pcm', 'rootPitch', 'pitch', 'velocity', 'gain'], 'sample zone');
    const id = text(zone.id ?? String(index), 'sample zone ID', 200);
    assert(!ids.has(id), 'DUPLICATE_ID', 'Sample zone IDs must be unique.');
    ids.add(id);
    const pcm = capturePCM(zone.pcm);
    total += pcm.channels[0].length * pcm.channels.length;
    assert(total <= 16_000_000, 'RESOURCE_LIMIT', 'Sample bank exceeds captured PCM budget.');
    return {
      id,
      pcm,
      root: midiPitch(zone.rootPitch),
      pitch: bounds(zone.pitch, [0, 127], 'pitch range'),
      velocity: bounds(zone.velocity, [0, 1], 'velocity range'),
      gain: number(zone.gain ?? 1, 'sample zone gain', 0, 4),
    };
  });
  assert(zones.length > 0, 'SOUND_ZONE', 'Supply at least one sample zone.');
  function play(pitch, optionsValue = {}) {
    options(optionsValue, ['velocity', 'duration', 'gain', 'pan', 'release'], 'sample note');
    const midi = midiPitch(pitch),
      velocity = number(optionsValue.velocity ?? 0.7, 'sample velocity', 0, 1),
      gain = number(optionsValue.gain ?? 1, 'sample note gain', 0, 4),
      pan = number(optionsValue.pan ?? 0, 'sample pan', -1, 1),
      release = number(optionsValue.release ?? 0.03, 'sample release', 0, 2);
    const matching = zones
      .filter(
        (zone) =>
          midi >= zone.pitch[0] &&
          midi <= zone.pitch[1] &&
          velocity >= zone.velocity[0] &&
          velocity <= zone.velocity[1],
      )
      .sort((a, b) => Math.abs(a.root - midi) - Math.abs(b.root - midi) || a.id.localeCompare(b.id));
    assert(matching.length > 0, 'SOUND_ZONE', 'No caller sample zone covers this pitch and velocity.');
    const selected = matching[0],
      ratio = 2 ** ((midi - selected.root) / 12);
    assert(
      ratio >= 0.25 && ratio <= 4,
      'SOUND_PITCH',
      'Repitch stays within two octaves; supply more root samples for wider ranges.',
    );
    const natural = selected.pcm.duration / ratio,
      duration = number(optionsValue.duration ?? natural, 'sample duration', 1 / rate, 30),
      count = Math.max(1, Math.round(duration * rate));
    assert(count * 32 <= 64_000_000, 'RESOURCE_LIMIT', 'Sample resampling exceeds the per-call work budget.');
    const channels = allocate(count),
      source = selected.pcm.channels;
    // Windowed sinc interpolation suppresses repitch aliases; 16 taps is an explicit bounded quality/CPU tradeoff.
    const cutoff = Math.min(1, 1 / ((ratio * selected.pcm.sampleRate) / rate)),
      left = Math.cos(((pan + 1) * Math.PI) / 4),
      right = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < channels[0].length; i++) {
      const position = (i / rate) * ratio * selected.pcm.sampleRate;
      if (position >= source[0].length) break;
      const center = Math.floor(position);
      for (let c = 0; c < 2; c++) {
        const data = source[Math.min(c, source.length - 1)];
        let value = 0,
          weight = 0;
        for (let k = -7; k <= 8; k++) {
          const index = center + k,
            distance = position - index,
            window = 0.5 + 0.5 * Math.cos((Math.PI * distance) / 8);
          if (Math.abs(distance) >= 8) continue;
          const x = Math.PI * distance * cutoff,
            w = (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x) * cutoff * window;
          weight += w;
          value += (data[index] ?? 0) * w;
        }
        channels[c][i] = (value / Math.max(weight, 1e-9)) * velocity * gain * selected.gain * (c === 0 ? left : right);
      }
    }
    fades(channels, rate, 0.002, release);
    return result(channels, rate, {
      source: 'caller-sample-bank',
      bank: name,
      zone: selected.id,
      midi,
      velocity,
      repitchRatio: ratio,
      pitchChangesDuration: true,
      quality: 'source-and-audition-dependent',
    });
  }
  function chord(pitches, settings = {}) {
    const list = dense(pitches, 'sample chord pitches', 16);
    assert(list.length > 0, 'SOUND_PITCH', 'A chord needs notes.');
    let estimated = 0;
    options(settings, ['velocity', 'duration', 'gain', 'pan', 'release'], 'sample chord');
    for (const pitch of list) {
      const midi = midiPitch(pitch),
        velocity = number(settings.velocity ?? 0.7, 'sample velocity', 0, 1),
        matching = zones
          .filter(
            (zone) =>
              midi >= zone.pitch[0] &&
              midi <= zone.pitch[1] &&
              velocity >= zone.velocity[0] &&
              velocity <= zone.velocity[1],
          )
          .sort((a, b) => Math.abs(a.root - midi) - Math.abs(b.root - midi) || a.id.localeCompare(b.id));
      assert(matching.length, 'SOUND_ZONE', 'No caller sample zone covers a chord pitch/velocity.');
      estimated += Math.round(
        rate *
          number(
            settings.duration ?? matching[0].pcm.duration / 2 ** ((midi - matching[0].root) / 12),
            'sample chord duration',
            1 / rate,
            30,
          ),
      );
    }
    assert(
      estimated * 32 <= 128_000_000 && estimated * 2 <= 16_000_000,
      'RESOURCE_LIMIT',
      'Sample chord resampling exceeds this call budget.',
    );
    const voices = list.map((pitch) => play(pitch, settings)),
      count = Math.max(...voices.map((voice) => voice.channels[0].length)),
      channels = allocate(count);
    for (const voice of voices)
      for (let c = 0; c < 2; c++)
        for (let i = 0; i < voice.channels[c].length; i++)
          channels[c][i] += voice.channels[c][i] / Math.sqrt(voices.length);
    if (peakOf(channels) > 0.95) scalePeak(channels, 0.95);
    return result(channels, rate, { source: 'caller-sample-bank-chord', bank: name, pitches: list.map(midiPitch) });
  }
  const bank = Object.freeze({
    name,
    zones: Object.freeze(
      zones.map((zone) =>
        Object.freeze({
          id: zone.id,
          rootPitch: zone.root,
          pitch: Object.freeze([...zone.pitch]),
          velocity: Object.freeze([...zone.velocity]),
        }),
      ),
    ),
    note: play,
    chord,
  });
  sampleBankRates.set(bank, rate);
  return bank;
}
