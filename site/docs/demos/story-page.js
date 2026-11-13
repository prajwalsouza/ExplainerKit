// This page is a scroll story. Its sections are the acts (timed by how long they take to read), and every code sample
// is a hold: while you read code, the story clock waits. A rail at the side of the page shows the acts, the holds, the
// clock and your place, built with storyTimeline from explainerkit/story over the page's own layout.
import { storyTimeline } from '../../runtime/src/story/index.js';
import { css } from './_kit.js';

const CSS = `
.story-rail { position: fixed; right: 18px; top: 50%; transform: translateY(-50%); z-index: 4; width: 132px; font: 11px/1.3 var(--sans); color: var(--muted); }
.story-rail .clock { font: 650 20px/1 var(--display); color: var(--ink); font-variant-numeric: tabular-nums; margin-bottom: 4px; }
.story-rail .act { margin-bottom: 10px; color: hsl(var(--h) var(--accent-s) var(--accent-l)); font-weight: 600; min-height: 2.6em; }
.story-rail .bar { position: relative; width: 6px; height: 46vh; border-radius: 3px; background: var(--line); }
.story-rail .seg { position: absolute; left: 0; width: 6px; border-radius: 3px; }
.story-rail .hold { position: absolute; left: -3px; width: 12px; height: 3px; border-radius: 2px; background: var(--ink); opacity: .5; }
.story-rail .you { position: absolute; left: -5px; width: 16px; height: 16px; margin-top: -8px; border-radius: 50%; background: hsl(var(--h) var(--accent-s) var(--accent-l)); box-shadow: 0 0 0 4px hsl(var(--h) var(--accent-s) var(--accent-l) / .2); }
.story-rail .held { margin-top: 8px; opacity: 0; transition: opacity .3s; color: var(--ink); font-weight: 600; }
.story-rail .held.on { opacity: 1; }
.sg { padding: 22px 26px; font-size: 14.5px; color: var(--muted); }
.sg b { color: var(--ink); }
@media (max-width: 1240px) { .story-rail { display: none; } }
`;

export default async function storyPage(stage, ctx) {
  css('story-page', CSS);
  stage.innerHTML = `<div class="sg"><b>This page is a scroll story.</b> Each section is an act, timed by how long it takes to read; every code sample is a hold, so the story clock waits while you read code. The rail at the right edge is the story's map: your place, the acts and the holds. It is <code>storyTimeline</code> run over this page's own layout.</div>`;
  const article = document.querySelector('article.doc');
  if (!article) return;
  const rail = Object.assign(document.createElement('aside'), { className: 'story-rail' });
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = `<div class="clock">0:00</div><div class="act"></div><div class="bar"></div><div class="held">held: reading code</div>`;
  document.body.append(rail);
  let map = null, actsMeta = [];
  // Acts from the page: each h2 section; its reading time (230 words a minute) is the act's time span; its code samples
  // are holds, as long on the page as they are tall.
  const build = () => {
    const heads = [...article.querySelectorAll('h2')], top = article.getBoundingClientRect().top + scrollY;
    const acts = [];let t = 0;
    actsMeta = [];
    heads.forEach((h, i) => {
      const start = h.getBoundingClientRect().top + scrollY - top, next = heads[i + 1] ? heads[i + 1].getBoundingClientRect().top + scrollY - top : article.offsetHeight;
      const nodes = [];for (let n = h; n && n !== heads[i + 1]; n = n.nextElementSibling) nodes.push(n);
      const words = nodes.reduce((s, n) => s + (n.matches('pre') ? 0 : (n.textContent.match(/\S+/g) ?? []).length), 0), span = Math.max(4, (words / 230) * 60);
      const length = Math.max(40, next - start), holds = [];
      for (const pre of nodes.filter((n) => n.matches('pre'))) {
        const at = t + span * Math.min(.98, Math.max(.02, (pre.getBoundingClientRect().top + scrollY - top - start) / length));
        if (!holds.length || at > holds.at(-1).at + .01) holds.push({ at, length: Math.min(length * .45, pre.offsetHeight) });
      }
      if (holds.reduce((s, x) => s + x.length, 0) >= length - 10) holds.length = 0;
      acts.push({ id: `a${i}`, from: t, to: t + span, length, holds });actsMeta.push({ name: h.textContent.trim() });
      t += span;
    });
    if (!acts.length) return;
    map = storyTimeline(acts, { duration: t });
    const bar = rail.querySelector('.bar');
    bar.innerHTML = map.acts.map((a, k) => `<div class="seg" style="top:${(a.start / map.length) * 100}%;height:calc(${(a.length / map.length) * 100}% - 3px);background:hsl(${ctx.hue + ((k * 37) % 60) - 30} 60% ${ctx.dark() ? 52 : 62}%)"></div>`).join('')
      + map.holds.map((p) => `<div class="hold" style="top:${(p / map.length) * 100}%"></div>`).join('') + '<div class="you"></div>';
  };
  const read = () => {
    if (!map) return;
    const pos = scrollY - (article.getBoundingClientRect().top + scrollY) + innerHeight * .35, s = map.sample(pos);
    rail.querySelector('.clock').textContent = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
    rail.querySelector('.act').textContent = actsMeta[s.index]?.name ?? '';
    rail.querySelector('.you').style.top = `${(Math.max(0, Math.min(map.length, pos)) / map.length) * 100}%`;
    rail.querySelector('.held').classList.toggle('on', s.hold !== null);
  };
  build();read();
  addEventListener('scroll', read, { passive: true });
  addEventListener('resize', () => { build();read(); });
  ctx.onTheme(() => { build();read(); });
}
