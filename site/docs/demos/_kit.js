// Shared helpers for documentation demos. A demo module exports `default async function (stage, ctx)`, where `stage` is
// its card's element and `ctx` is { hue, dark(), onTheme(fn), still }: the page's family hue, the theme now, a
// subscription to theme changes, and whether the reader asked for reduced motion.
import { hsla, toHex } from '../../runtime/src/color/index.js';

/** Add a demo's stylesheet once (scoped by its own class names). Page tokens (--h, --ink, --muted, …) are available. */
export function css(name, text) {
  if (document.querySelector(`style[data-demo="${name}"]`)) return;
  const style = document.createElement('style');
  style.setAttribute('data-demo', name);
  style.textContent = text;
  document.head.append(style);
}

/**
 * A scene colour from the page's palette as #rrggbb (scene fills take hex): hue offset from the page's hue,
 * saturation and lightness as for the light page; on the dark page lightness lifts so marks read on black.
 */
export function colour(ctx, dh = 0, s = 60, l = 50) {
  const h = (((ctx.hue + dh) % 360) + 360) % 360, light = ctx.dark() ? Math.min(82, l + 12) : l;
  return toHex(hsla(h, s, light)).slice(0, 7);
}

/** The page's ink and ground as hex, for scene text and backgrounds. */
export const ink = (ctx) => (ctx.dark() ? '#e5e1dc' : '#2c2a27');
export const ground = (ctx) => (ctx.dark() ? '#1c1b1a' : '#fbf9f5');

// Safari, Chrome and Edge play H.264 everywhere, and many iPhones cannot play VP9, so each clip also ships as an
// H.264 MP4 beside its WebM. A browser without H.264, such as some Firefox builds, gets the WebM.
const h264 = typeof document !== 'undefined' && document.createElement('video').canPlayType('video/mp4; codecs="avc1.640029"') !== '';
/** The address of a recorded clip in the format this browser should play: the MP4 where H.264 plays, else the WebM. */
export const clipSource = (url) => (h264 ? String(url).replace(/\.webm(?=$|[?#])/, '.mp4') : String(url));
