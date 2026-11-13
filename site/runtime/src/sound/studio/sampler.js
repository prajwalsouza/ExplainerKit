import { assert, number, options } from '../../core/validate.js';
import { dbToGain, midiToFrequency, readAudio, seeded } from './core.js';
import { defineInstrument, panGains } from './instrument.js';
import { midiPitch } from '../instruments.js';

const MAX_BANK_SAMPLES = 96_000_000;

function range(value, fallback, name, max) {
  const pair = value ?? fallback;
  assert(Array.isArray(pair) && pair.length === 2, 'SOUND_ZONE', `A ${name} has two ends.`);
  number(pair[0], name, 0, max);
  number(pair[1], name, pair[0], max);
  return [pair[0], pair[1]];
}

/**
 * Find a loop whose end lines up in phase with its start, then blend the
 * material before the start into the end so the jump back is inaudible.
 */
function bakeLoop(channels, rate, root, spec) {
  const frames = channels[0].length,
    start = Math.round(spec.start * frames),
    nominal = Math.round(spec.end * frames),
    fade = Math.min(start, Math.round(spec.crossfade * rate)),
    period = rate / midiToFrequency(root),
    search = Math.ceil(period * 2),
    window = Math.min(start, 2048);
  if (nominal - start < rate * 0.2 || fade < 16) return null;
  const mono = channels[0];
  let best = nominal,
    bestScore = -Infinity;
  for (let end = nominal - search; end <= nominal; end++) {
    let dot = 0,
      energy = 0;
    for (let i = 1; i <= window; i += 2) {
      dot += mono[end - i] * mono[start - i];
      energy += mono[end - i] * mono[end - i];
    }
    const score = dot / Math.sqrt(energy + 1e-12);
    if (score > bestScore) {
      bestScore = score;
      best = end;
    }
  }
  const looped = channels.map((channel) => {
    // Three samples past the loop end repeat the loop start, so interpolation can read across the jump.
    const copy = new Float32Array(best + 3);
    copy.set(channel.subarray(0, best));
    for (let i = 0; i < fade; i++) {
      const mix = (i + 1) / (fade + 1),
        t = Math.sin((mix * Math.PI) / 2) ** 2;
      copy[best - fade + i] = channel[best - fade + i] * (1 - t) + channel[start - fade + i] * t;
    }
    for (let i = 0; i < 3; i++) copy[best + i] = copy[start + i];
    return copy;
  });
  return { channels: looped, start, end: best };
}

/**
 * Instrument made from recordings. Each zone is one recorded note with the
 * pitch and velocity range it covers. The instrument can loop sustained notes,
 * layer several detuned players from neighbouring recordings, add vibrato and
 * darken quiet notes the way an acoustic instrument does.
 */
export function sampledInstrument(zoneInput, settings = {}) {
  options(
    settings,
    [
      'name',
      'attack',
      'release',
      'sustain',
      'loop',
      'dynamicRange',
      'brightness',
      'ensemble',
      'vibrato',
      'startOffset',
      'maxShift',
      'gain',
      'expression',
      'mechanics',
    ],
    'sampled instrument',
  );
  const sustain = settings.sustain ?? 'hold';
  assert(sustain === 'hold' || sustain === 'loop', 'SOUND_INSTRUMENT', 'Sustain is hold or loop.');
  let loop = null;
  if (sustain === 'loop') {
    const spec = settings.loop ?? {};
    options(spec, ['start', 'end', 'crossfade'], 'sample loop');
    loop = {
      start: number(spec.start ?? 0.4, 'loop start fraction', 0.05, 0.9),
      end: number(spec.end ?? 0.88, 'loop end fraction', 0.1, 1),
      crossfade: number(spec.crossfade ?? 0.25, 'loop crossfade', 0.005, 2),
    };
    assert(loop.end > loop.start, 'SOUND_INSTRUMENT', 'The loop must end after it starts.');
  }
  const attackSpec = settings.attack ?? 0.004,
    attacks = Array.isArray(attackSpec) ? attackSpec : [attackSpec, attackSpec];
  assert(attacks.length === 2, 'SOUND_INSTRUMENT', 'Attack is one time or [quiet, loud].');
  attacks.forEach((seconds) => number(seconds, 'sample attack', 0, 5));
  const release = number(settings.release ?? 0.3, 'sample release', 0.01, 10),
    dynamicRange = number(settings.dynamicRange ?? 30, 'dynamic range in dB', 0, 60),
    startOffset = number(settings.startOffset ?? 0, 'sample start offset', 0, 1),
    maxShift = number(settings.maxShift ?? 14, 'largest repitch in semitones', 0, 24),
    level = dbToGain(number(settings.gain ?? 0, 'instrument gain in dB', -48, 24)),
    expression = number(settings.expression ?? 1.4, 'expression curve', 0, 3);
  let brightness = null;
  if (settings.brightness !== undefined) {
    options(settings.brightness, ['low', 'high', 'keyTrack'], 'sample brightness');
    brightness = {
      low: number(settings.brightness.low ?? 900, 'quiet cutoff', 60, 20000),
      high: number(settings.brightness.high ?? 12000, 'loud cutoff', 60, 20000),
      keyTrack: number(settings.brightness.keyTrack ?? 0.5, 'brightness key tracking', 0, 1),
    };
  }
  let ensemble = { voices: 1, detune: 0, spread: 0, scatter: 0, neighbours: false };
  if (settings.ensemble !== undefined) {
    options(settings.ensemble, ['voices', 'detune', 'spread', 'scatter', 'neighbours'], 'sample ensemble');
    const count = settings.ensemble.voices ?? 4;
    assert(Number.isInteger(count) && count >= 1 && count <= 12, 'SOUND_INSTRUMENT', 'An ensemble has 1–12 players.');
    ensemble = {
      voices: count,
      detune: number(settings.ensemble.detune ?? 14, 'ensemble detune in cents', 0, 80),
      spread: number(settings.ensemble.spread ?? 0.7, 'ensemble spread', 0, 1),
      scatter: number(settings.ensemble.scatter ?? 0.03, 'ensemble scatter', 0, 0.25),
      neighbours: settings.ensemble.neighbours ?? true,
    };
  }
  let mechanics = null;
  if (settings.mechanics !== undefined) {
    options(settings.mechanics, ['level', 'strike', 'release'], 'sample mechanics');
    mechanics = {
      level: dbToGain(number(settings.mechanics.level ?? -30, 'mechanical noise level in dB', -80, 0)),
      strike: number(settings.mechanics.strike ?? 2600, 'strike noise frequency', 200, 12000),
      release: number(settings.mechanics.release ?? 0.5, 'release noise amount', 0, 2),
    };
  }
  let vibrato = null;
  if (settings.vibrato !== undefined) {
    options(settings.vibrato, ['rate', 'depth', 'delay', 'fade'], 'sample vibrato');
    vibrato = {
      rate: number(settings.vibrato.rate ?? 5.3, 'vibrato rate', 0.1, 12),
      depth: number(settings.vibrato.depth ?? 12, 'vibrato depth in cents', 0, 100),
      delay: number(settings.vibrato.delay ?? 0.25, 'vibrato delay', 0, 5),
      fade: number(settings.vibrato.fade ?? 0.5, 'vibrato fade', 0.01, 5),
    };
  }

  assert(
    Array.isArray(zoneInput) && zoneInput.length >= 1 && zoneInput.length <= 512,
    'SOUND_ZONE',
    'Give 1–512 zones.',
  );
  let captured = 0;
  const zones = zoneInput.map((zone, index) => {
    options(zone, ['id', 'pcm', 'rootPitch', 'pitch', 'velocity', 'gain', 'tune'], 'sample zone');
    const { channels, rate } = readAudio(zone.pcm, `zone ${index + 1}`);
    captured += channels[0].length * channels.length;
    assert(captured <= MAX_BANK_SAMPLES, 'RESOURCE_LIMIT', 'The sample bank exceeds 96 million samples.');
    const root = midiPitch(zone.rootPitch) + number(zone.tune ?? 0, 'zone tuning in cents', -100, 100) / 100;
    const copies = channels.map((channel) => Float32Array.from(channel));
    const baked = loop ? bakeLoop(copies, rate, root, loop) : null;
    return {
      id: zone.id ?? String(index),
      channels: baked ? baked.channels : copies,
      loopStart: baked ? baked.start : -1,
      loopEnd: baked ? baked.end : -1,
      rate,
      root,
      pitch: range(zone.pitch, [0, 127], 'zone pitch range', 127),
      velocity: range(zone.velocity, [0, 1], 'zone velocity range', 1),
      gain: dbToGain(number(zone.gain ?? 0, 'zone gain in dB', -48, 24)),
    };
  });

  function candidates(pitch, velocity) {
    const matching = zones.filter(
      (zone) => velocity >= zone.velocity[0] && velocity <= zone.velocity[1] && Math.abs(pitch - zone.root) <= maxShift,
    );
    const inRange = matching.filter((zone) => pitch >= zone.pitch[0] && pitch <= zone.pitch[1]);
    const pool = inRange.length ? inRange : matching;
    return pool.sort((a, b) => Math.abs(a.root - pitch) - Math.abs(b.root - pitch));
  }

  const lowest = Math.min(...zones.map((zone) => zone.root)) - maxShift,
    highest = Math.max(...zones.map((zone) => zone.root)) + maxShift;
  return defineInstrument(
    {
      kind: 'sampler',
      name: settings.name ?? 'sampled instrument',
      release: release + ensemble.scatter + 0.02,
      cost: 9 * ensemble.voices,
      range: [Math.max(0, Math.ceil(lowest)), Math.min(127, Math.floor(highest))],
    },
    (voice) => {
      const { left, right, rate, start, gate, pitch, velocity, dynamics } = voice;
      const nearest = candidates(pitch, velocity);
      if (!nearest.length) return;
      const random = seeded(`${voice.seed}:${pitch}:${start}`);
      const players = ensemble.voices,
        attack = attacks[0] + (attacks[1] - attacks[0]) * velocity,
        base = voice.gain * level * dbToGain(-dynamicRange * (1 - velocity)) * (1 / Math.sqrt(players));
      if (mechanics) {
        // Hammer and key noise: a short band of noise at the strike and a duller knock when the key comes up.
        const [noiseL, noiseR] = panGains(voice.pan + (random() - 0.5) * 0.5),
          amount = voice.gain * level * mechanics.level * (0.3 + 0.7 * velocity),
          pole = 1 - Math.exp((-2 * Math.PI * mechanics.strike) / rate),
          strikeFrames = Math.round(0.045 * rate),
          knockFrames = Math.round(0.07 * rate);
        let band = 0,
          lows = 0;
        for (let i = 0; i < strikeFrames && start + i < left.length; i++) {
          const white = random() * 2 - 1;
          band += pole * (white - band);
          lows += 0.02 * (band - lows);
          const value = (band - lows) * amount * Math.min(1, i / 24) * Math.exp(-i / (0.009 * rate));
          left[start + i] += value * noiseL * Math.SQRT2;
          right[start + i] += value * noiseR * Math.SQRT2;
        }
        let knock = 0;
        for (let i = 0; i < knockFrames && start + gate + i < left.length; i++) {
          knock += 0.03 * (random() * 2 - 1 - knock);
          const value = knock * amount * mechanics.release * 4 * Math.min(1, i / 48) * Math.exp(-i / (0.015 * rate));
          left[start + gate + i] += value * noiseL * Math.SQRT2;
          right[start + gate + i] += value * noiseR * Math.SQRT2;
        }
      }
      // Neighbouring recordings give each player a different instrument tone and bow noise.
      const pool = ensemble.neighbours ? nearest.slice(0, Math.min(3, nearest.length)) : nearest.slice(0, 1);
      for (let player = 0; player < players; player++) {
        const zone = pool[player % pool.length],
          position = players === 1 ? 0 : (player / (players - 1)) * 2 - 1,
          cents = players === 1 ? 0 : (random() - 0.5) * ensemble.detune,
          late = Math.round(random() * ensemble.scatter * rate),
          from = start + late,
          total = Math.min(left.length - from, gate + Math.ceil(release * rate));
        if (total <= 0) continue;
        const step = (2 ** ((pitch - zone.root + cents / 100) / 12) * zone.rate) / rate,
          source = zone.channels,
          stereo = source.length === 2,
          a = source[0],
          b = source[stereo ? 1 : 0],
          length = a.length,
          looping = zone.loopEnd > 0,
          loopLength = zone.loopEnd - zone.loopStart;
        const [panL, panR] = panGains(Math.max(-1, Math.min(1, voice.pan + position * ensemble.spread)));
        const attackFrames = Math.max(1, Math.round(attack * rate * (players > 1 ? 0.8 + 0.4 * random() : 1))),
          releaseFrames = Math.max(1, Math.round(release * rate)),
          endFade = Math.round(0.03 * zone.rate);
        const vibratoStep = vibrato ? (2 * Math.PI * vibrato.rate * (0.92 + 0.16 * random())) / rate : 0,
          vibratoPhase = 2 * Math.PI * random(),
          vibratoDepth = vibrato ? (vibrato.depth / 1200) * 0.6931 * (0.75 + 0.5 * random()) : 0,
          vibratoDelay = vibrato ? vibrato.delay * rate : 0,
          vibratoFade = vibrato ? Math.max(1, vibrato.fade * rate) : 1;
        // A looped sample can start anywhere inside its attack-free region, which separates the players further.
        let cursor = (startOffset + (players > 1 ? random() * 0.012 : 0)) * zone.rate;
        const cutoffLow = brightness ? brightness.low * 2 ** ((brightness.keyTrack * (pitch - 60)) / 12) : 0,
          cutoffRatio = brightness ? brightness.high / brightness.low : 1;
        let g = 0,
          lowL = 0,
          lowR = 0,
          lowL2 = 0,
          lowR2 = 0,
          dynamic = dynamics ? dynamics[Math.min(dynamics.length - 1, from >> 6)] : 1,
          speed = step;
        for (let i = 0; i < total; i++) {
          if ((i & 15) === 0) {
            if (dynamics) dynamic += 0.25 * (dynamics[Math.min(dynamics.length - 1, (from + i) >> 6)] - dynamic);
            if (vibrato && i > vibratoDelay) {
              const depth = Math.min(1, (i - vibratoDelay) / vibratoFade);
              speed = step * (1 + vibratoDepth * depth * Math.sin(vibratoPhase + vibratoStep * i));
            }
            if (brightness) {
              const amount = Math.min(1, velocity * (0.35 + 0.65 * dynamic)),
                hz = cutoffLow * cutoffRatio ** amount;
              g = 1 - Math.exp((-2 * Math.PI * Math.min(hz, rate * 0.45)) / rate);
            }
          }
          if (looping) {
            if (cursor >= zone.loopEnd) cursor -= loopLength;
          } else if (cursor >= length - 2) break;
          const whole = cursor | 0;
          const t = cursor - whole,
            i0 = whole > 0 ? whole - 1 : 0;
          // Four-point Hermite interpolation between recorded samples.
          let y0 = a[i0],
            y1 = a[whole],
            y2 = a[whole + 1],
            y3 = a[whole + 2];
          let l = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)));
          let r = l;
          if (stereo) {
            y0 = b[i0];
            y1 = b[whole];
            y2 = b[whole + 1];
            y3 = b[whole + 2];
            r = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)));
          }
          cursor += speed;
          if (brightness) {
            lowL += g * (l - lowL);
            lowR += g * (r - lowR);
            lowL2 += g * (lowL - lowL2);
            lowR2 += g * (lowR - lowR2);
            l = lowL2;
            r = lowR2;
          }
          let amp = base * zone.gain;
          if (i < attackFrames) amp *= 0.5 - 0.5 * Math.cos((Math.PI * i) / attackFrames);
          if (i >= gate) {
            const out = (i - gate) / releaseFrames;
            amp *= out >= 1 ? 0 : (1 - out) * (1 - out);
          }
          if (!looping && length - whole < endFade) amp *= (length - whole) / endFade;
          if (dynamics) amp *= dynamic ** expression;
          left[from + i] += l * amp * panL * Math.SQRT2;
          right[from + i] += r * amp * panR * Math.SQRT2;
        }
      }
    },
  );
}
