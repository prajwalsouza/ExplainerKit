// Shared plumbing for the character pages' demos (not a demo itself). A live stage builds an ExplainerKit scene at the
// card's own width, mounts it with the canvas renderer and plays it; it rebuilds on a theme change or a real resize,
// maps pointer events into scene coordinates, and runs one bounded animation-frame loop only while the card is on
// screen. A follower eases a live target with the analytic spring from explainerkit/physics, retargeted from its
// current value and velocity, so cursor-driven poses move like weight rather than snapping.
import { spring } from '../../runtime/src/physics/index.js';
import { css } from './_kit.js';

css('characters-live', `
.ckl { position: relative; touch-action: none; user-select: none; -webkit-user-select: none; }
.ckl > .explainerkit-stage { position: relative; }
.ckl canvas { display: block; }
.ckl-bubble { position: absolute; left: 0; top: 0; padding: 7px 12px 8px; border-radius: 16px; background: var(--panel); color: var(--ink); font: 600 14px/1.2 var(--sans); box-shadow: 0 6px 18px hsl(var(--h) 30% 20% / .16); border: 1px solid hsl(var(--h) 20% var(--edge-l)); pointer-events: none; white-space: nowrap; opacity: 0; transform-origin: 50% 100%; transition: opacity .18s; }
.ckl-bubble::after { content: ''; position: absolute; left: 50%; bottom: -6px; width: 10px; height: 10px; margin-left: -5px; background: inherit; border-right: inherit; border-bottom: inherit; transform: rotate(45deg); }
.ckl-hint { position: absolute; left: 0; right: 0; bottom: 12px; text-align: center; font: 500 12.5px/1.3 var(--sans); color: var(--muted); pointer-events: none; transition: opacity .6s; }
`);

/**
 * @param {HTMLElement} stage
 * @param {{dark():boolean,onTheme(fn:()=>void):void,still:boolean}} ctx
 * @param {{height:number|((w:number)=>number), build:(size:{W:number,H:number})=>any, label?:string}} spec
 * build returns {drawing, frame?(time, player), still?: number}
 */
export function liveStage(stage, ctx, spec) {
  const root = document.createElement('div');
  root.className = 'ckl';
  stage.append(root);
  let world = null, player = null, generation = 0, width = 0, raf = 0, visible = true;
  const listeners = [];
  async function rebuild() {
    const g = ++generation;
    const W = Math.max(280, Math.round(stage.clientWidth || 640)), H = typeof spec.height === 'function' ? spec.height(W) : spec.height;
    width = W;
    const next = spec.build({ W, H });
    const holder = document.createElement('div');
    const nextPlayer = await next.drawing.mount(holder, { controls: false, height: H });
    if (g !== generation) { nextPlayer.dispose(); return; }
    player?.dispose();
    root.querySelector(':scope > .ckl-holder')?.remove();
    holder.className = 'ckl-holder';
    root.prepend(holder);
    world = next; player = nextPlayer;
    if (ctx.still) player.seek(next.still ?? Math.min(2, player.duration), { reset: false });
    else player.play();
    for (const fn of listeners) fn(world, player);
  }
  const loop = () => {
    raf = 0;
    if (!visible || !world) return;
    try { world.frame?.(player.time, player); } catch (error) { console.error(error); }
    raf = requestAnimationFrame(loop);
  };
  const wake = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(stage);
  let pending = 0;
  new ResizeObserver(() => {
    if (Math.abs(stage.clientWidth - width) < 24) return;
    clearTimeout(pending); pending = setTimeout(() => rebuild().then(wake), 220);
  }).observe(stage);
  ctx.onTheme(() => rebuild().then(wake));
  const ready = rebuild().then(wake);
  return {
    root, ready,
    get world() { return world; },
    get player() { return player; },
    get time() { return player?.time ?? 0; },
    /** Called after every (re)build with (world, player). */
    onBuild(fn) { listeners.push(fn); },
    /** Client coordinates into scene coordinates. */
    toScene(event) {
      const box = root.getBoundingClientRect();
      return { x: (event.clientX - box.left) * (world ? width / box.width : 1), y: event.clientY - box.top };
    },
  };
}

/** A 1D follower: set(target, now) retargets an analytic spring from the current value and velocity. */
export function follower(value, { stiffness = 120, damping = 18 } = {}) {
  let motion = spring({ from: value, to: value, stiffness, damping, mass: 1 }), target = value;
  return {
    get target() { return target; },
    set(next, now) {
      if (next === target) return;
      const at = Math.max(0, now), state = motion.state(Math.max(at, motion.at));
      target = next;
      motion = spring({ from: state.value, to: next, velocity: state.velocity, stiffness, damping, mass: 1, at });
    },
    kick(velocity, now) {
      const at = Math.max(0, now), state = motion.state(Math.max(at, motion.at));
      motion = spring({ from: state.value, to: target, velocity: state.velocity + velocity, stiffness, damping, mass: 1, at });
    },
    at(now) { return motion.sample(Math.max(now, motion.at)); },
  };
}

/** A speech bubble over a scene point; show(text, seconds). */
export function bubble(root) {
  const el = document.createElement('div');
  el.className = 'ckl-bubble';
  root.append(el);
  let until = -1;
  return {
    show(text, now, seconds = 1.6) { el.textContent = text; until = now + seconds; },
    place(x, y, now) {
      const on = now < until;
      el.style.opacity = on ? '1' : '0';
      if (on) el.style.transform = `translate(${Math.round(x - el.offsetWidth / 2)}px, ${Math.round(y - el.offsetHeight - 8)}px)`;
    },
  };
}

/** A quiet hint line that fades once the reader has done something. */
export function hint(root, text) {
  const el = document.createElement('div');
  el.className = 'ckl-hint';
  el.textContent = text;
  root.append(el);
  return { done() { el.style.opacity = '0'; } };
}
