import { ellipse } from './shapes.js';
import { clamp, lerp, smooth } from './timing.js';

const f = (v) => Object.freeze(v);

/**
 * Mouth shapes after the Rhubarb Lip Sync / Preston Blair set (descriptions only; see
 * docs/research/character-animation.md). open: jaw opening, width: corner spread, round: pucker, teeth: upper teeth visible.
 */
export const MOUTH_SHAPES = f({
  A: f({ open: 0, width: 0.8, round: 0, teeth: 0 }), // M, B, P: closed with pressure
  B: f({ open: 0.16, width: 0.95, round: 0, teeth: 1 }), // most consonants, EE
  C: f({ open: 0.45, width: 0.9, round: 0.05, teeth: 0.6 }), // EH, AE
  D: f({ open: 0.85, width: 1, round: 0.1, teeth: 0.4 }), // AA as in "father"
  E: f({ open: 0.45, width: 0.7, round: 0.45, teeth: 0 }), // AO, ER
  F: f({ open: 0.28, width: 0.45, round: 1, teeth: 0 }), // OO, W
  G: f({ open: 0.14, width: 0.9, round: 0, teeth: 1 }), // F, V
  H: f({ open: 0.55, width: 0.85, round: 0.1, teeth: 0.3 }), // long L
  X: f({ open: 0, width: 0.7, round: 0, teeth: 0 }), // rest
});

// A letter-based approximation of the phoneme → shape mapping. Not phoneme recognition.
const LETTERS = {
  m: 'A',
  b: 'A',
  p: 'A',
  f: 'G',
  v: 'G',
  l: 'H',
  o: 'E',
  u: 'F',
  w: 'F',
  q: 'F',
  a: 'D',
  e: 'C',
  i: 'B',
  y: 'B',
  r: 'E',
};

/** Speech timeline for text at a rate in characters per second; returns shape weights at time t. */
export function speech(text, { at = 0, rate = 13 } = {}) {
  const slots = [];
  let t = at;
  for (const ch of text.toLowerCase()) {
    const shape = /[a-z]/.test(ch) ? (LETTERS[ch] ?? 'B') : /\s/.test(ch) ? 'X' : 'X';
    const duration = /[.,!?;:]/.test(ch) ? 4 / rate : 1 / rate;
    if (slots.length && slots.at(-1).shape === shape) slots.at(-1).end = t + duration;
    else slots.push({ shape, start: t, end: t + duration });
    t += duration;
  }
  const end = t;
  return f({
    at,
    end,
    text,
    /** Mouth parameters at time t, with 40 ms crossfades between shapes. */
    sample(time) {
      if (time < at || time > end + 0.12) return null;
      const i = slots.findIndex((s) => time < s.end);
      const current = slots[i === -1 ? slots.length - 1 : i],
        previous = slots[(i === -1 ? slots.length : i) - 1];
      const a = MOUTH_SHAPES[previous?.shape ?? 'X'],
        b = MOUTH_SHAPES[i === -1 ? 'X' : current.shape],
        s = smooth((time - (i === -1 ? end : current.start)) / 0.04);
      return Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], b[k], s)]));
    },
    /** Times of word starts, for small head nods on stressed words. */
    words: f(
      text
        .split(/\s+/)
        .filter(Boolean)
        .map((w, i, list) => at + list.slice(0, i).join(' ').length / rate + (i ? 1 / rate : 0)),
    ),
  });
}

/**
 * Closed mouth outline. smile in [-1, 1] lifts or drops the corners; open/width/round as in MOUTH_SHAPES.
 * size is the neutral mouth width in character units.
 */
export function mouthPath(cx, cy, size, { open = 0, width = 0.8, round = 0, smile = 0 } = {}) {
  const w = size * width * (1 - 0.5 * round) * (1 + 0.15 * Math.max(0, smile)),
    h = size * 0.55 * open + size * 0.12 * round * open;
  const lift = -smile * size * 0.22,
    cornerY = cy + lift;
  const thickness = Math.max(size * 0.07, h);
  const upper = cy - h * 0.35 + (round ? -h * 0.1 : 0),
    lower = cy + thickness + Math.max(0, smile) * size * 0.18 - Math.min(0, smile) * size * 0.05;
  const l = [cx - w / 2, cornerY],
    r = [cx + w / 2, cornerY];
  return f([
    f(['M', ...l]),
    f(['Q', cx, 2 * upper - cornerY - (round ? h * 0.2 : 0), ...r]),
    f(['Q', cx, 2 * lower - cornerY + (round ? h * 0.2 : 0), ...l]),
    f(['Z']),
  ]);
}

export function eyePath(cx, cy, rx, ry) {
  return ellipse(cx, cy, rx, ry);
}

/** Pupil centred where the eye looks; look x/y in [-1, 1] of the available travel. */
export function pupilPath(cx, cy, rx, ry, r, look = [0, 0]) {
  const lx = clamp(look[0], -1, 1),
    ly = clamp(look[1], -1, 1);
  return ellipse(cx + lx * (rx - r * 1.05), cy + ly * (ry - r * 1.05), r, r);
}

/**
 * Upper lid covering the eye from the top down to closure c in [0, 1], with a slightly curved edge.
 * lower in [0, 1] raises a lower lid for squints and smiles. Clip to the eye outline.
 */
export function lidPath(cx, cy, rx, ry, closure = 0, lower = 0) {
  const top = cy - ry - 1,
    bottom = cy + ry + 1,
    edge = lerp(top, bottom, clamp(closure)),
    sag = ry * 0.25 * (1 - Math.abs(closure * 2 - 1));
  const lowEdge = lerp(bottom, cy, clamp(lower) * 0.9);
  const out = [
    f(['M', cx - rx - 1, top]),
    f(['L', cx + rx + 1, top]),
    f(['L', cx + rx + 1, edge]),
    f(['Q', cx, edge + sag * 2, cx - rx - 1, edge]),
    f(['Z']),
  ];
  if (lower > 0)
    out.push(
      f(['M', cx - rx - 1, bottom]),
      f(['L', cx - rx - 1, lowEdge]),
      f(['Q', cx, lowEdge - ry * 0.5 * lower, cx + rx + 1, lowEdge]),
      f(['L', cx + rx + 1, bottom]),
      f(['Z']),
    );
  return f(out);
}

/**
 * A brow as a short rounded bar. raise moves it up (in thicknesses); tilt > 0 lifts the inner end (worry),
 * tilt < 0 drops it (anger). side is where the inner end sits: -1 left, 1 right.
 */
export function browPath(cx, cy, length, thickness, { raise = 0, tilt = 0, side = 1 } = {}) {
  const y = cy - raise * thickness * 2.2,
    k = tilt * length * 0.3,
    t = thickness / 2;
  const a = [cx - length / 2, y - (side < 0 ? k : -k * 0.3)],
    b = [cx + length / 2, y - (side > 0 ? k : -k * 0.3)];
  const mid = (a[1] + b[1]) / 2 - t * 0.8;
  return f([
    f(['M', a[0], a[1] - t]),
    f(['Q', cx, mid - t, b[0], b[1] - t]),
    f(['Q', b[0] + t, b[1], b[0], b[1] + t]),
    f(['Q', cx, mid + t, a[0], a[1] + t]),
    f(['Q', a[0] - t, a[1], a[0], a[1] - t]),
    f(['Z']),
  ]);
}

/** Expression presets: the face channels each mood sets. Bodies add their own pose on top. */
export const MOODS = f({
  neutral: f({ smile: 0, browRaise: 0, browTilt: 0, squint: 0, eyeScale: 1 }),
  happy: f({ smile: 0.8, browRaise: 0.35, browTilt: -0.1, squint: 0.45, eyeScale: 1 }),
  sad: f({ smile: -0.65, browRaise: 0.2, browTilt: 0.7, squint: 0.1, eyeScale: 0.95 }),
  surprised: f({ smile: 0, browRaise: 1, browTilt: 0, squint: 0, eyeScale: 1.18 }),
  angry: f({ smile: -0.35, browRaise: -0.5, browTilt: -0.8, squint: 0.25, eyeScale: 0.95 }),
  thinking: f({ smile: -0.1, browRaise: 0.4, browTilt: 0.25, squint: 0.15, eyeScale: 1 }),
  sleepy: f({ smile: 0.05, browRaise: -0.1, browTilt: 0, squint: 0, eyeScale: 1 }),
});
