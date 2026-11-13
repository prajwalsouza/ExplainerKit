// Day and night for the landing page. The page's colours are CSS tokens (style.css); this module holds the choice
// and gives the canvas layers the same rule. Objects drawn in the scene (paper planes, the ribbon, seeds, data marks)
// keep their colours, lit a little lower at night; surfaces and text drawn into a canvas (cards, labels, outlines)
// use `surface`, which mirrors lightness at night so paper turns to the matte-black ground and ink turns pale, while
// mid-tones keep their character. One rule, so new colours need no night twin.
import { hsla } from 'explainerkit/color';

const KEY = 'explainerkit-landing-theme';
const root = document.documentElement;
const listeners = new Set();

function saved() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'night' || value === 'day' ? value : null;
  } catch {
    return null;
  }
}

// Light by default, whatever the system says; dark only when the reader switches to it (and that is remembered).
let mode = saved() ?? 'day';

function apply() {
  root.classList.toggle('night', mode === 'night');
  root.classList.toggle('day', mode === 'day');
  for (const fn of listeners) fn(mode);
}

/** Lightness mirrored for night: paper (high) becomes the ground, ink (low) becomes pale, mid-tones stay close. */
const KNOTS = [
  [0, 92],
  [30, 80],
  [55, 56],
  [80, 22],
  [100, 9],
];
function mirror(l) {
  for (let i = 1; i < KNOTS.length; i++) {
    const [x0, y0] = KNOTS[i - 1],
      [x1, y1] = KNOTS[i];
    if (l <= x1) return y0 + ((y1 - y0) * (l - x0)) / (x1 - x0);
  }
  return KNOTS.at(-1)[1];
}

/**
 * The brand colour follows the theme: vermilion on the light page, blue on the dark one. The Earth's core stays red
 * in both; on a dark page the point it hands over to turns from red to blue as the live chapter opens.
 */
export const BRAND = Object.freeze({ day: Object.freeze({ h: 10, s: 76, l: 55 }), night: Object.freeze({ h: 214, s: 78, l: 56 }) });
export const brand = () => BRAND[mode === 'night' ? 'night' : 'day'];
/** Brand HSLA at a lightness offset (for gradients and edges). */
export const brandHsla = (dl = 0, a = 1, ds = 0) => { const b = brand();return hsla(b.h, Math.max(0, Math.min(100, b.s + ds)), Math.max(0, Math.min(100, b.l + dl)), a); };
export const theme = {
  get mode() {
    return mode;
  },
  get night() {
    return mode === 'night';
  },
  /** Switch, remember the reader's choice, and tell the layers. */
  set(next) {
    if (next !== 'day' && next !== 'night') return;
    mode = next;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* A private window keeps the choice for this visit only. */
    }
    apply();
  },
  toggle() {
    this.set(mode === 'night' ? 'day' : 'night');
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** A surface or text colour drawn into a canvas, given as its day HSLA: at night its lightness is mirrored. */
export function surface(h, s, l, a = 1) {
  if (mode !== 'night') return hsla(h, s, l, a);
  const night = mirror(Math.max(0, Math.min(100, l)));
  // Dark grounds are matte black (barely warm, almost no colour); inks keep a trace of their hue.
  return hsla(night < 40 ? 30 : h, night < 40 ? Math.min(s, 4) : Math.min(s, 30), night, a);
}

apply();
