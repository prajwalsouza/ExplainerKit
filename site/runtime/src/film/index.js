// ExplainerKit films: a narrated, seekable player around ordinary ExplainerKit scenes.
// A film is chapters of scenes; a scene is a two-tone title, caption beats, and a build function.
// Everything on stage is a pure function of the scene's local time, so seeking is exact.
import { scene as createScene } from '../core/index.js';
import { beats as createBeats, clamp, lerp, ease } from '../core/motion.js';
import { createSVGRenderer } from '../renderers/svg.js';
import { transformPoint } from '../camera/math.js';
import { analyse, planLayout, applyLayout, toAuthored } from '../layout/adaptive.js';
import { createClock } from '../player/clock.js';
import { assert, number } from '../core/validate.js';

const mountedFilms = new WeakMap();

/**
 * One ground, one ink, one accent; kinds of thing take one colour each, on stage and in captions.
 * The bright kind colours are for marks. Words in a kind's colour use its `…Ink` variant, the same hue
 * darkened to at least 4.5:1 on paper, card and the warm grounds (WCAG 2.2 text contrast). `ink3` is
 * for rules and decoration only: at 2.6:1 it is too faint for text.
 */
export const palette = Object.freeze({
  paper: '#fbfaf7',
  ink: '#17181c',
  ink2: '#5d5f66',
  ink3: '#9a9ca3',
  line: '#e7e4dc',
  card: '#ffffff',
  accent: '#ff5b2e',
  blue: '#3b6fd4',
  green: '#2f9a6f',
  violet: '#7b61c9',
  accentInk: '#c93c14',
  blueInk: '#2f5fbf',
  greenInk: '#1f7a55',
  violetInk: '#6247b0',
});

const STAGE = Object.freeze({ width: 1600, height: 900 });
const PREBUILD_LEAD = 4; // Seconds of playback before a boundary by which the next scene is built.
const TITLE = 2.8;
const DISPLAY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter Tight', Inter, 'Segoe UI', sans-serif";
const PLAY = 'M3 1.5v13l11-6.5z',
  PAUSE = 'M3 2h3.5v12H3zM9.5 2H13v12H9.5z';

const SHELL = `
<main class="film"><div class="screen" id="wrap">
  <div id="stage" role="img" aria-label="Animated explainer stage"></div>
  <div class="tip" id="tip" hidden></div>
  <div class="pin" id="pin" hidden><h3 id="pinT"></h3><p id="pinB"></p><button type="button" id="pinX" aria-label="Close">×</button></div>
  <button class="bigplay" id="bigplay" type="button"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${PLAY}"/></svg><span id="bigplayT">Play</span></button>
</div><p class="cap" id="cap" aria-live="polite"></p></main>
<nav class="band" aria-label="Playback">
  <button type="button" id="play" aria-label="Play (Space)"><svg viewBox="0 0 16 16" aria-hidden="true"><path id="playicon" d="${PLAY}"/></svg></button>
  <div class="bar" id="bar" tabindex="0" role="slider" aria-label="Seek" aria-valuemin="0"><div class="bartip" id="bartip" hidden></div></div>
  <span class="time" id="time">0:00 / 0:00</span>
  <button type="button" id="more" aria-label="More options" aria-haspopup="true" aria-expanded="false" aria-controls="menu"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></svg></button>
</nav>
<div class="menu" id="menu" role="menu" hidden>
  <div class="row">Speed<span class="speeds" id="speeds"></span></div>
  <button type="button" class="row" id="cc" role="menuitemcheckbox">Captions<span class="sw"></span></button>
  <button type="button" class="row" id="voice" role="menuitemcheckbox">Read aloud<span class="sw"></span></button>
  <hr>
  <button type="button" class="row" id="chapBtn" role="menuitem">Chapters<kbd>C</kbd></button>
  <button type="button" class="row" id="scriptBtn" role="menuitem">Script<kbd>N</kbd></button>
  <button type="button" class="row" id="fs" role="menuitem">Full screen<kbd>F</kbd></button>
  <p class="keys">Space play · ← → 5 s · Shift ← → scene</p>
</div>
<aside class="sheet" id="sheet" hidden aria-labelledby="sheetT"><header><b id="sheetT"></b><button type="button" id="sheetX" aria-label="Close">×</button></header><div class="body" id="sheetBody"></div></aside>
<div class="cursor" id="cursor" aria-hidden="true"><i></i><b></b></div>`;

const formatTime = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const TEXT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif";
let measurer;
/** Text width. ExplainerKit has no text layout yet, so the film measures with Canvas in the stage's fonts. */
function measure(text, size, weight = 600) {
  measurer ??= document.createElement('canvas').getContext('2d');
  measurer.font = `${weight} ${size}px ${weight >= 600 ? DISPLAY : TEXT}`;
  if ('letterSpacing' in measurer) measurer.letterSpacing = weight >= 600 ? `${-0.04 * size}px` : '0px';
  return measurer.measureText(text).width;
}

/** The title alone, centred as one line in two tones, then gone before the first visual arrives. */
function titleCard(s, title) {
  const [first, second = ''] = title.split(' | '),
    ids = new Set();
  let size = 84;
  const gap = () => size * 0.28,
    width = () => measure(first, size) + (second ? gap() + measure(second, size) : 0);
  while (width() > STAGE.width * 0.88 && size > 40) size -= 4;
  let x = (STAGE.width - width()) / 2;
  for (const [text, fill] of [
    [first, palette.ink],
    [second, palette.accent],
  ]) {
    if (!text) continue;
    ids.add(
      s
        .text({
          text,
          x,
          y: STAGE.height / 2,
          fontSize: size,
          fontWeight: 600,
          letterSpacing: -0.04 * size,
          fill,
          baseline: 'middle',
        })
        .enter(0.05, { lift: 14 })
        .exit(TITLE - 0.55, { style: 'rise', duration: 0.5 }).id,
    );
    x += measure(text, size) + gap();
  }
  return ids;
}

/**
 * Mount a film on the page.
 * - `chapters`: [{ name, scenes: [{ title: 'first | second', beats: [lines], build(s, b, film) }] }]
 * - `terms`: [[RegExp, colour]] tints caption words in the colour their kind has on stage
 * - `store`: viewer state that should survive from one scene to the next
 * - `notes`: provenance shown with the chapters
 * - `prebuild`: 1 (default) builds the next scene ahead, in idle time or a few seconds before its boundary, so
 *   crossing it only swaps layers; 0 builds on demand. A prebuilt scene is discarded and rebuilt if a top-level
 *   `store` value changed after it was built.
 * `build` receives the ExplainerKit scene `s`, its beat timeline `b`, and `film` for player-level services.
 */
export function film(definition) {
  const { chapters: chapterDefs, terms = [], store = {}, notes = '', prebuild = 1 } = definition;
  assert(prebuild === 0 || prebuild === 1, 'INVALID_FILM', 'prebuild must be 0 or 1.');
  assert(Array.isArray(chapterDefs) && chapterDefs.length > 0, 'INVALID_FILM', 'A film needs chapters.');
  const chapters = [],
    scenes = [];
  let total = 0;
  for (const chapter of chapterDefs) {
    assert(Array.isArray(chapter.scenes) && chapter.scenes.length > 0, 'INVALID_FILM', 'Every chapter needs scenes.');
    assert(
      chapter.description === undefined ||
        (typeof chapter.description === 'string' && chapter.description.length <= 10000),
      'INVALID_FILM',
      'Chapter descriptions must be text of at most 10000 characters.',
    );
    const entry = { name: chapter.name, description: chapter.description ?? '', scenes: [] };
    for (const sc of chapter.scenes) {
      assert(
        typeof sc.title === 'string' && typeof sc.build === 'function',
        'INVALID_FILM',
        'A scene needs a title and build function.',
      );
      assert(
        sc.description === undefined || (typeof sc.description === 'string' && sc.description.length <= 10000),
        'INVALID_FILM',
        'Scene descriptions must be text of at most 10000 characters.',
      );
      const b = createBeats(sc.beats, { lead: TITLE });
      entry.scenes.push(scenes.length);
      scenes.push({ ...sc, b, chapter: chapters.length, start: total, plain: sc.title.replace(' | ', ' ') });
      total += b.duration;
    }
    chapters.push(entry);
  }
  number(total, 'film duration', 0, 86400);
  mountedFilms.get(document)?.dispose();
  const bodyClasses = new Map(
    ['nostart', 'playing', 'nocc', 'idle'].map((name) => [name, document.body.classList.contains(name)]),
  );
  const shell = document.createElement('div');
  shell.className = 'explainerkit-film-root';
  shell.style.display = 'contents';
  shell.insertAdjacentHTML('afterbegin', SHELL); // Constant first-party markup; authored text uses textContent.
  document.body.prepend(shell);
  document.body.classList.add('nostart');
  const $ = (id) => shell.querySelector(`#${id}`);
  const stage = $('stage'),
    cap = $('cap'),
    bar = $('bar'),
    synth = window.speechSynthesis ?? null;
  let time = 0,
    speed = 1,
    voice = false,
    captions = definition.captions ?? true,
    started = false;
  let live = null,
    building = null,
    captionKey = '',
    captionTimer = null,
    sheetMode = null,
    beatNow = -1,
    dragging = null;
  let tweens = [],
    stageTap = null,
    idleTimer = null,
    dragScreenSpace = false,
    ready = null,
    job = null;
  const failedPrebuild = new Set();
  const fading = [],
    timers = new Set(),
    removers = [];
  let clock, controller;
  const sceneAt = (t) => {
    for (let i = scenes.length - 1; i >= 0; i--) if (t >= scenes[i].start) return i;
    return 0;
  };
  function later(fn, delay) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!clock?.disposed) fn();
    }, delay);
    timers.add(id);
    return id;
  }
  function cancelTimer(id) {
    clearTimeout(id);
    timers.delete(id);
  }
  function listen(target, name, fn, options) {
    const guarded = (event) => {
      if (clock?.disposed) return;
      try {
        fn(event);
      } catch (error) {
        clock?.pause();
        clock?.reportError(error);
      }
    };
    target.addEventListener(name, guarded, options);
    removers.push(() => target.removeEventListener(name, guarded, options));
    return guarded;
  }
  const redraw = () => clock?.invalidate();
  const services = {
    store,
    tween(parameter, to, seconds = 0.45) {
      assert(!clock.disposed, 'DISPOSED', 'This film has been disposed.');
      number(seconds, 'tween duration', 1e-3, 3600);
      if (clock.reducedMotion) {
        parameter.set(to);
        redraw();
        return;
      }
      tweens.push({ parameter, from: parameter.sample(services.now()), to, start: performance.now() / 1000, seconds });
      redraw();
    },
    now: () => time - scenes[(building ?? live)?.i ?? 0].start,
    onStageTap(fn) {
      if (building) building.stageTap = fn;
      else stageTap = fn;
    },
  };
  function releaseScene(old) {
    old.unsubscribe?.();
    old.renderer?.dispose();
    old.layer?.remove();
  }
  function build(i) {
    const sc = scenes[i],
      s = createScene({ ...STAGE, label: sc.plain, description: sc.description ?? chapters[sc.chapter].description });
    const candidate = {
      i,
      s,
      b: sc.b,
      title: titleCard(s, sc.title),
      opacity: new Map(),
      marked: new Set(),
      plan: null,
      stageTap: null,
    };
    building = candidate;
    try {
      sc.build(s, sc.b, services);
    } finally {
      building = null;
    }
    candidate.layer = document.createElement('div');
    candidate.layer.className = 'layer';
    candidate.layer.style.opacity = '0';
    stage.append(candidate.layer);
    try {
      candidate.renderer = createSVGRenderer(candidate.layer, { label: sc.plain });
    } catch (error) {
      candidate.layer.remove();
      throw error;
    }
    return candidate;
  }
  // Build, lay out and render a scene into a hidden layer, so reaching it later only swaps layers.
  function prepare(i) {
    const candidate = build(i);
    candidate.layer.className = 'explainerkit-film-prebuilt';
    candidate.layer.style.cssText = 'opacity:0;visibility:hidden;position:absolute;inset:0;pointer-events:none';
    try {
      candidate.store = Object.keys(store).map((key) => [key, store[key]]);
      const { next, view } = compose(candidate, 0);
      candidate.renderer.render(next);
      candidate.frame = next;
      candidate.view = view;
    } catch (error) {
      releaseScene(candidate);
      throw error;
    }
    return candidate;
  }
  const storeUnchanged = (snap) =>
    Object.keys(store).length === snap.length &&
    snap.every(([key, value]) => Object.hasOwn(store, key) && Object.is(store[key], value));
  function take(i) {
    if (ready?.i !== i) return null;
    const candidate = ready;
    ready = null;
    if (storeUnchanged(candidate.store)) return candidate;
    releaseScene(candidate);
    return null;
  }
  function cancelPrebuild() {
    job?.cancel();
    job = null;
  }
  function discardPrebuilt() {
    cancelPrebuild();
    if (ready) releaseScene(ready);
    ready = null;
  }
  /** Schedule the next scene's build for idle time, due PREBUILD_LEAD seconds of playback before its boundary. */
  function planPrebuild() {
    if (!prebuild || clock.disposed || !live) return;
    const next = live.i + 1;
    if (ready && ready.i !== next) {
      releaseScene(ready);
      ready = null;
    }
    if (next >= scenes.length || ready || failedPrebuild.has(next)) return;
    const wall = clock.playing
      ? Math.max(0, (scenes[next].start - time) / Math.max(clock.speed || 1, 0.01) - PREBUILD_LEAD) * 1000
      : 250;
    const due = performance.now() + wall;
    if (job && job.next === next && job.due <= due + 100) return;
    cancelPrebuild();
    const run = () => {
      job = null;
      if (clock.disposed || live?.i + 1 !== next || ready) return;
      try {
        ready = prepare(next);
      } catch {
        failedPrebuild.add(next);
      } // The on-demand build reports the error at the boundary.
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: Math.max(1, wall) });
      job = { next, due, cancel: () => cancelIdleCallback(id) };
    } else {
      const id = setTimeout(run, wall);
      job = { next, due, cancel: () => clearTimeout(id) };
    }
  }
  function commitScene(candidate) {
    for (const old of fading.splice(0)) {
      cancelTimer(old.timer);
      releaseScene(old);
    }
    if (live) {
      const old = live;
      old.unsubscribe?.();
      old.layer.style.opacity = '0';
      old.timer = later(() => {
        releaseScene(old);
        const at = fading.indexOf(old);
        if (at >= 0) fading.splice(at, 1);
      }, 560);
      fading.push(old);
    }
    live = candidate;
    stageTap = candidate.stageTap;
    tweens = [];
    failedPrebuild.clear();
    if (live.layer.className !== 'layer') {
      live.layer.className = 'layer';
      live.layer.style.cssText = 'opacity:0';
    }
    live.layer.style.opacity = '1';
    live.unsubscribe = live.s.onChange(redraw);
    try {
      history.replaceState(null, '', `#${candidate.i + 1}`);
    } catch {
      /* sandboxed hosts */
    }
    segments.forEach((seg, j) => {
      seg.fill.style.width = j < candidate.i ? '100%' : '0';
    });
    if (sheetMode === 'chapters') markSheet();
  }
  function draw({ reset = false } = {}) {
    const i = sceneAt(time),
      changed = live?.i !== i,
      candidate = changed ? (take(i) ?? build(i)) : live;
    const sc = scenes[i],
      local = time - sc.start,
      now = performance.now() / 1000;
    const checkpoint = reset && !changed ? candidate.s._checkpoint() : null;
    try {
      if (reset) {
        tweens = [];
        if (!changed) candidate.s.reset();
      }
      tweens = tweens.filter((t) => {
        const k = ease.easeInOut((now - t.start) / t.seconds);
        t.parameter.set(lerp(t.from, t.to, k));
        return k < 1;
      });
      const { next, view } = compose(candidate, local);
      candidate.renderer.render(next);
      candidate.frame = next;
      candidate.view = view;
    } catch (error) {
      if (checkpoint) candidate.s._restore(checkpoint);
      if (changed) releaseScene(candidate);
      throw error;
    }
    if (changed) commitScene(candidate);
    trackOpacity(candidate.frame);
    const beat = sc.b.index(local),
      key = `${i}:${beat}`;
    if (key !== captionKey) {
      captionKey = key;
      beatNow = beat;
      const line = sc.b.lines[beat] ?? '';
      cancelTimer(captionTimer);
      cap.classList.add('fade');
      captionTimer = later(
        () => {
          if (captionKey === key && live?.i === i) {
            showCaption(line);
            cap.classList.remove('fade');
          }
        },
        clock.reducedMotion ? 0 : 180,
      );
      if (voice && clock.playing && line) speak(line);
      if (sheetMode === 'script') markSheet();
    }
    segments[i].fill.style.width = `${((local / sc.b.duration) * 100).toFixed(2)}%`;
    $('time').textContent = `${formatTime(time)} / ${formatTime(total)}`;
    bar.setAttribute('aria-valuenow', Math.round(time));
    bar.setAttribute('aria-valuetext', `${formatTime(time)}, ${sc.plain}`);
    stage.setAttribute('aria-label', sc.plain);
    stage.setAttribute('aria-description', sc.description ?? chapters[sc.chapter].description);
    planPrebuild();
    return { frame: candidate.frame };
  }
  function compose(candidate, local) {
    const sampled = candidate.s.sampleView({ time: local }),
      plan = layoutFor(candidate);
    // A deliberate camera shot keeps one reference frame; adaptive re-stacking would undo it.
    const fit = plan.fit;
    const next = sampled.view
      ? {
          width: plan.container.width,
          height: plan.container.height,
          children: [
            {
              id: 'film:camera',
              type: 'group',
              props: {
                x: fit.x - fit.source.x0 * fit.scale,
                y: fit.y - fit.source.y0 * fit.scale,
                scaleX: fit.scale,
                scaleY: fit.scale,
                rotation: 0,
                opacity: 1,
              },
              children: sampled.frame.children,
            },
          ],
        }
      : applyLayout(sampled.frame, plan);
    return { next, view: sampled.view };
  }
  function layoutFor(scene) {
    const r = stage.getBoundingClientRect(),
      container = { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) };
    const cameraMode = !!scene.s.activeCamera;
    if (
      scene.plan &&
      scene.planCameraMode === cameraMode &&
      scene.plan.container.width === container.width &&
      scene.plan.container.height === container.height
    )
      return scene.plan;
    if (scene.s.activeCamera) {
      scene.plan = planLayout({ items: [], authored: STAGE, container, policy: { minText: 1, targetText: 1 } });
      scene.planCameraMode = true;
      return scene.plan;
    }
    const times = scene.b.starts.flatMap((start, k) => [start + 0.95, start + scene.b.lengths[k] - 0.05]);
    const frames = times.map((sampleTime) => scene.s.sample({ time: sampleTime }));
    const items = analyse(frames, {
      measure: (text, size, weight) => measure(text, size, weight),
      exclude: scene.title,
      tagsOf: (id) => scene.s.tagsOf(id),
    });
    scene.plan = planLayout({ items, authored: STAGE, container, policy: scene.s.adaptivePolicy });
    scene.planCameraMode = false;
    return scene.plan;
  }
  function trackOpacity(frame) {
    live.opacity.clear();
    const visit = (node, parent) => {
      const o = parent * (node.props.opacity ?? 1);
      live.opacity.set(node.id, o);
      if (!live.marked.has(node.id) && live.s.interaction(node.id)) {
        live.layer.querySelector(`[data-explainerkit-id="${node.id}"]`)?.classList.add('hot');
        live.marked.add(node.id);
      }
      for (const child of node.children ?? []) visit(child, o);
    };
    for (const node of frame.children) visit(node, 1);
  }
  function showCaption(line) {
    cap.replaceChildren();
    if (!terms.length) {
      cap.textContent = line;
      return;
    }
    const pattern = new RegExp(terms.map(([re]) => `(${re.source})`).join('|'), 'gi');
    let last = 0;
    // A term may contain its own groups; each term's wrapping group starts after all groups before it.
    const starts = [];
    let group = 1;
    for (const [re] of terms) {
      starts.push(group);
      group += 1 + (new RegExp(`${re.source}|`).exec('').length - 1);
    }
    for (const match of line.matchAll(pattern)) {
      const which = starts.findIndex((g) => match[g] !== undefined);
      const term = document.createElement('span');
      term.textContent = match[0];
      term.style.color = terms[which][1];
      term.style.fontWeight = '500';
      cap.append(line.slice(last, match.index), term);
      last = match.index + match[0].length;
    }
    cap.append(line.slice(last));
  }
  const beatEnd = () => {
    const sc = scenes[sceneAt(time)],
      local = time - sc.start,
      k = sc.b.index(local);
    return sc.start + (k < 0 ? sc.b.starts[0] : sc.b.starts[k] + sc.b.lengths[k]);
  };
  clock = createClock({
    host: window,
    duration: total,
    maxDelta: 0.1,
    sample(next, detail) {
      const previous = time;
      time = next;
      try {
        return draw(detail);
      } catch (error) {
        time = previous;
        throw error;
      }
    },
    advance: (next) => (voice && synth?.speaking ? Math.min(next, Math.max(time, beatEnd() - 0.05)) : next),
    needsFrame: () => tweens.length > 0,
  });
  function speak(line) {
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.rate = Math.min(1.6, 0.98 * speed);
      synth.speak(u);
    } catch {
      /* speech unavailable */
    }
  }
  function begin() {
    if (!started) {
      started = true;
      $('bigplay').hidden = true;
      document.body.classList.remove('nostart');
    }
  }
  function playingUI() {
    const playing = clock.playing;
    if (playing) begin();
    document.body.classList.toggle('playing', playing);
    $('play').setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} (Space)`);
    $('playicon').setAttribute('d', playing ? PAUSE : PLAY);
    if (!playing) synth?.cancel();
    else {
      captionKey = '';
      $('pin').hidden = true;
    }
    idle();
  }
  function setPlaying(value) {
    if (value) clock.play();
    else clock.pause();
  }
  function seek(t, options) {
    assert(!clock.disposed, 'DISPOSED', 'This film has been disposed.');
    begin();
    synth?.cancel();
    captionKey = '';
    clock.seek(clamp(t, 0, total), options);
    return controller;
  }
  function pause(info) {
    clock.pause();
    if (!info) return;
    $('pinT').textContent = info.title;
    $('pinB').textContent = info.body;
    $('pin').hidden = false;
    $('tip').hidden = true;
  }
  const prevScene = () => {
    const i = sceneAt(time);
    seek(time - scenes[i].start > 2 ? scenes[i].start : scenes[Math.max(0, i - 1)].start);
  };
  const nextScene = () => {
    const i = sceneAt(time);
    if (i < scenes.length - 1) seek(scenes[i + 1].start);
  };
  const segments = scenes.map((sc, i) => {
    const seg = document.createElement('i'),
      fill = document.createElement('b');
    seg.style.flex = String(sc.b.duration);
    if (i && chapters[sc.chapter].scenes[0] === i) seg.className = 'ch';
    seg.append(fill);
    bar.append(seg);
    return { seg, fill };
  });
  bar.setAttribute('aria-valuemax', Math.round(total));
  const timeAt = (e) => {
    const r = bar.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width) * total;
  };
  let scrubbing = false;
  listen(bar, 'pointerdown', (e) => {
    scrubbing = true;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch {
      /* old browsers */
    }
    seek(timeAt(e));
  });
  listen(bar, 'pointermove', (e) => {
    const t = timeAt(e),
      r = bar.getBoundingClientRect(),
      tip = $('bartip'),
      stamp = document.createElement('i');
    stamp.textContent = formatTime(t);
    tip.replaceChildren(stamp, scenes[sceneAt(t)].plain);
    tip.hidden = false;
    tip.style.left = `${clamp(e.clientX - r.left, 90, r.width - 90)}px`;
    if (scrubbing) seek(t);
  });
  listen(bar, 'pointerup', () => {
    scrubbing = false;
  });
  listen(bar, 'pointercancel', () => {
    scrubbing = false;
  });
  listen(bar, 'pointerleave', () => {
    if (!scrubbing) $('bartip').hidden = true;
  });
  listen(bar, 'keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const forward = e.key === 'ArrowRight';
    if (e.shiftKey) (forward ? nextScene : prevScene)();
    else seek(time + (forward ? 5 : -5));
  });
  const menu = $('menu'),
    more = $('more'),
    sheet = $('sheet'),
    sheetBody = $('sheetBody');
  const setMenu = (open) => {
    menu.hidden = !open;
    more.setAttribute('aria-expanded', open);
    if (open) closeSheet();
  };
  listen(more, 'click', (e) => {
    e.stopPropagation();
    setMenu(menu.hidden);
  });
  listen(document, 'click', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== more) setMenu(false);
  });
  for (const v of [0.75, 1, 1.25, 1.5, 2]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${v}×`;
    button.setAttribute('aria-pressed', v === 1);
    listen(button, 'click', () => {
      speed = v;
      clock.speed = v;
      for (const x of $('speeds').children) x.setAttribute('aria-pressed', x === button);
    });
    $('speeds').append(button);
  }
  const toggle = (id, on) => $(id).setAttribute('aria-pressed', on);
  document.body.classList.toggle('nocc', !captions);
  toggle('cc', captions);
  toggle('voice', false);
  if (!synth) {
    $('voice').disabled = true;
    $('voice').title = 'Speech is not available here';
  }
  listen($('cc'), 'click', () => {
    captions = !captions;
    toggle('cc', captions);
    document.body.classList.toggle('nocc', !captions);
    redraw();
  });
  listen($('voice'), 'click', () => {
    voice = !voice;
    toggle('voice', voice);
    if (voice) {
      captionKey = '';
      redraw();
    } else synth?.cancel();
  });
  const fullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      /* not allowed */
    }
  };
  listen($('fs'), 'click', () => {
    setMenu(false);
    fullscreen();
  });
  listen($('chapBtn'), 'click', () => {
    setMenu(false);
    openSheet('chapters');
  });
  listen($('scriptBtn'), 'click', () => {
    setMenu(false);
    openSheet('script');
  });
  listen($('sheetX'), 'click', closeSheet);
  listen($('pinX'), 'click', () => {
    $('pin').hidden = true;
  });
  listen($('play'), 'click', () => setPlaying(!clock.playing));
  listen($('bigplay'), 'click', () => setPlaying(true));
  $('bigplayT').textContent = `Play · ${total < 90 ? formatTime(total) : `${Math.round(total / 60)} min`}`;
  function openSheet(mode) {
    if (sheetMode === mode) {
      closeSheet();
      return;
    }
    sheetMode = mode;
    sheetBody.replaceChildren();
    $('sheetT').textContent = mode === 'chapters' ? 'Chapters' : 'Script';
    const heading = (text, at) => {
      const h = document.createElement('h4');
      h.textContent = text;
      if (at !== undefined) {
        const t = document.createElement('span');
        t.textContent = formatTime(at);
        h.append(t);
      }
      sheetBody.append(h);
    };
    const item = (at, text, key) => {
      const b = document.createElement('button'),
        stamp = document.createElement('i'),
        label = document.createElement('span');
      b.type = 'button';
      b.className = 'it';
      b.dataset.k = key;
      stamp.textContent = formatTime(at);
      label.textContent = text;
      b.append(stamp, label);
      b.onclick = () => seek(at + 0.01);
      sheetBody.append(b);
    };
    if (mode === 'chapters') {
      chapters.forEach((c) => {
        heading(c.name, scenes[c.scenes[0]].start);
        for (const i of c.scenes) item(scenes[i].start, scenes[i].plain, String(i));
      });
      if (notes) {
        const n = document.createElement('p');
        n.className = 'notes';
        n.textContent = notes;
        sheetBody.append(n);
      }
    } else
      scenes.forEach((sc) => {
        heading(sc.plain);
        sc.b.lines.forEach((line, k) => item(sc.start + sc.b.starts[k], line, `${scenes.indexOf(sc)}:${k}`));
      });
    sheet.hidden = false;
    markSheet();
  }
  function closeSheet() {
    sheetMode = null;
    sheet.hidden = true;
  }
  function markSheet() {
    const key = sheetMode === 'chapters' ? String(live?.i) : `${live?.i}:${beatNow}`;
    for (const b of sheetBody.querySelectorAll('.it')) {
      b.classList.toggle('now', b.dataset.k === key);
      if (b.dataset.k === key) b.scrollIntoView({ block: 'nearest' });
    }
  }
  const screenSpaceEvent = (e) => {
    if (live?.view)
      for (let node = e.target; node && node !== stage; node = node.parentNode)
        if ((live.view.screenRoots ?? live.view.overlayRoots).includes(node.getAttribute?.('data-explainerkit-id')))
          return true;
    return false;
  };
  const stagePoint = (e, screenSpace = screenSpaceEvent(e)) => {
    const r = stage.getBoundingClientRect(),
      p = { x: e.clientX - r.left, y: e.clientY - r.top };
    const authored = live?.plan ? toAuthored(live.plan, p) : p;
    if (screenSpace) return authored;
    return live?.view ? transformPoint(live.view.inverse, authored) : authored;
  };
  function pick(e, kind) {
    for (let n = e.target; live && n && n !== stage; n = n.parentNode) {
      const id = n.getAttribute?.('data-explainerkit-id');
      if (!id) continue;
      if ((live.opacity.get(id) ?? 0) < 0.2) return null;
      const record = live.s.interaction(id);
      if (record?.[kind]) return record[kind];
    }
    return null;
  }
  const tip = $('tip'),
    wrap = $('wrap');
  listen(stage, 'pointerdown', (e) => {
    const drag = pick(e, 'drag');
    if (!drag) return;
    e.preventDefault();
    pause();
    dragging = drag;
    dragScreenSpace = screenSpaceEvent(e);
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* old browsers */
    }
    drag(stagePoint(e, dragScreenSpace));
    redraw();
  });
  listen(stage, 'pointermove', (e) => {
    if (dragging) {
      dragging(stagePoint(e, dragScreenSpace));
      redraw();
      return;
    }
    const info = pick(e, 'explain');
    if (!info) {
      tip.hidden = true;
      return;
    }
    const title = document.createElement('b');
    title.textContent = info.title;
    tip.replaceChildren(title, info.body);
    tip.hidden = false;
    const r = wrap.getBoundingClientRect();
    let x = e.clientX - r.left + 18,
      y = e.clientY - r.top + 18;
    if (x + tip.offsetWidth > r.width - 8) x -= tip.offsetWidth + 36;
    if (y + tip.offsetHeight > r.height - 8) y -= tip.offsetHeight + 36;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.max(8, y)}px`;
  });
  const release = () => {
    const callback = dragging;
    dragging = null;
    dragScreenSpace = false;
    try {
      callback?.(null);
    } finally {
      redraw();
    }
  };
  listen(stage, 'pointerup', release);
  listen(stage, 'pointercancel', release);
  listen(stage, 'pointerleave', () => {
    tip.hidden = true;
  });
  listen(stage, 'click', (e) => {
    const tap = pick(e, 'tap');
    if (tap) {
      pause();
      tap(stagePoint(e));
      redraw();
      return;
    }
    const info = pick(e, 'explain');
    if (info) {
      pause(info);
      return;
    }
    if (stageTap && started) {
      pause();
      stageTap(stagePoint(e));
      redraw();
    }
  });
  const cursor = $('cursor'),
    ring = cursor.querySelector('b'),
    dot = cursor.querySelector('i');
  // The cursor follows pointer events directly; it does not own a second perpetual RAF loop.
  listen(stage, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    for (const part of [dot, ring]) {
      part.style.left = `${e.clientX}px`;
      part.style.top = `${e.clientY}px`;
    }
    cursor.classList.add('on');
    cursor.classList.toggle('hot', !!e.target.closest?.('.hot'));
  });
  listen(stage, 'pointerleave', () => cursor.classList.remove('on'));
  function idle() {
    document.body.classList.remove('idle');
    cancelTimer(idleTimer);
    idleTimer = later(() => {
      if (clock.playing && menu.hidden) document.body.classList.add('idle');
    }, 2400);
  }
  listen(window, 'pointermove', idle);
  listen(document, 'keydown', (e) => {
    const tag = e.target.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || e.target.isContentEditable) return;
    idle();
    const key = e.key.toLowerCase();
    if (key === ' ') {
      if (tag === 'BUTTON') return;
      e.preventDefault();
      setPlaying(!clock.playing);
    } else if (key === 'arrowright') {
      e.preventDefault();
      e.shiftKey ? nextScene() : seek(time + 5);
    } else if (key === 'arrowleft') {
      e.preventDefault();
      e.shiftKey ? prevScene() : seek(time - 5);
    } else if (key === 'f') fullscreen();
    else if (key === 'c') openSheet('chapters');
    else if (key === 'n') openSheet('script');
    else if (key === 'escape') {
      setMenu(false);
      closeSheet();
      $('pin').hidden = true;
    }
  });
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(redraw) : null;
  resize?.observe(stage);
  listen(window, 'resize', redraw);
  clock.on('play', playingUI);
  clock.on('pause', playingUI);
  clock.on('motionBlocked', (message) => {
    $('bigplayT').textContent = message;
  });
  clock.on('error', (error) => {
    cap.textContent = `${error.code ?? 'PLAYBACK_FAILED'}: ${error.message ?? 'Playback stopped.'}`;
    cap.classList.remove('fade');
  });
  controller = {
    seek,
    play() {
      clock.play();
      return controller;
    },
    pause() {
      clock.pause();
      return controller;
    },
    get reducedMotion() {
      return clock.reducedMotion;
    },
    get speed() {
      return clock.speed;
    },
    set speed(v) {
      clock.speed = v;
    },
    syncTime(syncTime, options) {
      clock.sync(syncTime, options);
      return controller;
    },
    setDriver(driver) {
      clock.setDriver(driver);
      return controller;
    },
    on: (name, fn) => clock.on(name, fn),
    reportError: (error) => clock.reportError(error),
    refresh() {
      return clock.refresh();
    },
    dispose: () => clock.dispose(),
    get time() {
      return clock.time;
    },
    get duration() {
      return total;
    },
    get total() {
      return total;
    },
    get playing() {
      return clock.playing;
    },
    get disposed() {
      return clock.disposed;
    },
    get driver() {
      return clock.driver;
    },
    get scene() {
      return live?.s;
    },
    get prebuilt() {
      return ready?.i ?? null;
    },
    get frame() {
      return live?.frame;
    },
    get view() {
      return live?.view;
    },
    get plan() {
      return live?.plan?.report;
    },
    scenes: scenes.map((sc) => ({ start: sc.start, duration: sc.b.duration, title: sc.plain })),
  };
  clock.on('dispose', () => {
    synth?.cancel();
    tweens = [];
    stageTap = null;
    try {
      dragging?.(null);
    } catch {
      /* Cleanup remains terminal. */
    }
    dragging = null;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const remove of removers) remove();
    resize?.disconnect();
    for (const old of fading.splice(0)) releaseScene(old);
    if (live) releaseScene(live);
    live = null;
    discardPrebuilt();
    shell.remove();
    for (const [name, wasPresent] of bodyClasses) document.body.classList.toggle(name, wasPresent);
    if (window.explainerkitFilm === controller) delete window.explainerkitFilm;
    if (mountedFilms.get(document) === controller) mountedFilms.delete(document);
  });
  mountedFilms.set(document, controller);
  window.explainerkitFilm = controller;
  const deepLink = parseInt(location.hash.slice(1), 10),
    initial = deepLink > 1 && deepLink <= scenes.length ? scenes[deepLink - 1].start + 1.6 : 1.6;
  try {
    clock.seek(Math.min(initial, total), { reset: false });
  } catch (error) {
    controller.dispose();
    throw error;
  }
  return controller;
}
