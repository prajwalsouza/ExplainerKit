// Your pace, felt. A field of motes streams past as you scroll this very page: at a reading pace they drift, skimming
// they hurry, rushing they stretch into streaks; stop and they settle. The word for your pace (scrollPace from
// explainerkit/story) floats among them. Scrolling up turns the stream around.
import { scrollPace } from '../../runtime/src/story/index.js';
import { css } from './_kit.js';

const CSS = `.spf { position: relative; height: 300px; overflow: hidden; } .spf canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.spf-word, .spf-nums, .spf-tip { text-shadow: 0 0 12px var(--panel), 0 0 4px var(--panel); }
.spf-word { position: absolute; left: 30px; top: 26px; font: 650 40px/1 var(--display); letter-spacing: -.03em; color: var(--ink); transition: opacity .4s, letter-spacing .4s; }
.spf-nums { position: absolute; left: 32px; top: 76px; font: 12.5px/1.5 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.spf-tip { position: absolute; left: 32px; right: 32px; bottom: 18px; font-size: 13.5px; color: var(--muted); }`;
const WORD = { still: 'Still', reading: 'Reading', skimming: 'Skimming', rushing: 'Rushing' };
const TIP = {
  still: 'Scroll the page (not this card). The field reads you.',
  reading: 'Reading: a story might let a figure walk off, or play a transition in full.',
  skimming: 'Skimming: a good moment to start loading the next act.',
  rushing: 'Rushing: play the quick version. The frame shown still depends only on where you are.',
};

export default async function storyPace(stage, ctx) {
  css('story-pace', CSS);
  stage.innerHTML = '<div class="spf"><canvas aria-hidden="true"></canvas><div class="spf-word">Still</div><div class="spf-nums">0 px/s</div><div class="spf-tip"></div></div>';
  const box = stage.querySelector('.spf'), canvas = box.querySelector('canvas'), g = canvas.getContext('2d');
  const word = box.querySelector('.spf-word'), nums = box.querySelector('.spf-nums'), tip = box.querySelector('.spf-tip');
  const events = new AbortController(), media = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = Boolean(ctx.still || media.matches);
  const still = () => reducedMotion;
  let disposed = false, visible = true, request = null, until = 0;
  const allowed = () => !disposed && visible && !document.hidden;
  const stop = () => { if (request !== null) cancelAnimationFrame(request);request = null; };
  function wake(milliseconds = 1600) {
    if (!allowed()) return;
    until = Math.max(until, performance.now() + milliseconds);
    if (request === null) request = requestAnimationFrame(frame);
  }
  let w = 0, h = 0;
  const fit = () => { const r = devicePixelRatio || 1;w = box.clientWidth;h = box.clientHeight;canvas.width = w * r;canvas.height = h * r;g.setTransform(r, 0, 0, r, 0, 0);wake(0); };
  const resize = new ResizeObserver(fit);resize.observe(box);
  const pace = scrollPace({ viewportHeight: innerHeight });
  addEventListener('scroll', () => { if (!allowed()) return;pace.add(scrollY, performance.now());wake(); }, { passive: true, signal: events.signal });
  // Motes at three depths: nearer ones are larger, faster and brighter; each has its own hue along the page's run.
  const motes = Array.from({ length: 140 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: .25 + (i % 3) * .37, k: Math.random() }));
  let speed = 0, dir = 1, last = performance.now(), shownPace = 'still';
  const frame = (now) => {
    request = null;if (!allowed()) return;
    const dt = still() ? 0 : Math.min(.05, (now - last) / 1000);last = now;
    const s = pace.sample(now);
    speed = still() ? 0 : speed + (Math.min(8, s.speed) - speed) * Math.min(1, dt * 4);
    word.style.transition = still() ? 'none' : '';
    if (s.direction) dir = s.direction;
    g.clearRect(0, 0, w, h);
    const dark = ctx.dark(), drift = .02 + speed * .35;
    for (const m of motes) {
      m.y -= dir * drift * m.z * dt;m.x += Math.sin(now / 2000 + m.k * 6) * .002 * dt * 60 * (1 - Math.min(1, speed));
      if (m.y < -.05) m.y += 1.1;if (m.y > 1.05) m.y -= 1.1;
      const px = m.x * w, py = m.y * h, len = Math.min(140, speed * 26 * m.z), r = 1 + m.z * 2.2;
      g.strokeStyle = g.fillStyle = `hsl(${ctx.hue - 30 + m.k * 60} ${dark ? 70 : 60}% ${dark ? 58 + m.z * 20 : 48 + m.z * 10}% / ${.25 + m.z * .6})`;
      if (len > 3) { g.lineWidth = r * 1.4;g.lineCap = 'round';g.beginPath();g.moveTo(px, py);g.lineTo(px, py + dir * len);g.stroke(); }
      else { g.beginPath();g.arc(px, py, r, 0, 6.283);g.fill(); }
    }
    if (s.pace !== shownPace) { shownPace = s.pace;word.textContent = WORD[shownPace];tip.textContent = TIP[shownPace]; }
    word.style.letterSpacing = `${-0.03 + Math.min(.08, speed * .02)}em`;
    nums.textContent = `${Math.round(Math.abs(s.velocity))} px/s · ${s.speed.toFixed(2)} screens/s${s.direction < 0 ? ' · upward' : ''}`;
    if (!still() && now < until) request = requestAnimationFrame(frame);
  };
  tip.textContent = TIP.still;
  const visibility = () => { stop();last = performance.now();if (allowed()) wake(0); };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting;visibility(); });
  observer.observe(stage);
  document.addEventListener('visibilitychange', visibility, {signal: events.signal});
  media.addEventListener('change', () => { reducedMotion = media.matches;visibility(); }, {signal: events.signal});
  const offTheme = ctx.onTheme(() => wake(0));
  fit();
  return () => {
    if (disposed) return;
    disposed = true;stop();events.abort();resize.disconnect();observer.disconnect();offTheme();
  };
}
