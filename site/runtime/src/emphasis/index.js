import { assert, number, options, text } from '../core/validate.js';
import { ease as easings } from '../core/motion.js';
import { hsla, toHSLA, toHex, toRGBA } from '../color/space.js';
import { mix } from '../color/interpolate.js';
import { contrastRGB } from '../color/perceptual.js';

// Emphasis draws the eye to one target while its context recedes. The state is a pure
// function of time, so a scrubbed, reversed or exported frame shows the same emphasis.

const NAME = /^[A-Za-z_][\w.-]{0,63}$/;
const RECEDE_KEYS = ['opacity', 'desaturate', 'blur'];
const DEFAULT_RECEDE = Object.freeze({ opacity: 0.55, desaturate: 0.35, blur: 0 });

function recedeSpec(value, fallback) {
  if (value === undefined) return fallback;
  options(value, RECEDE_KEYS, 'recede');
  return Object.freeze({
    opacity: number(value.opacity ?? fallback.opacity, 'recede opacity', 0.15, 1),
    desaturate: number(value.desaturate ?? fallback.desaturate, 'recede desaturate', 0, 1),
    blur: number(value.blur ?? fallback.blur, 'recede blur', 0, 8),
  });
}
function easing(name) {
  if (typeof name === 'function') return name;
  const key = name ?? 'easeInOut';
  assert(
    typeof key === 'string' && Object.hasOwn(easings, key) && typeof easings[key] === 'function',
    'INVALID_EASE',
    `Use a named easing such as easeInOut, not ${String(key)}.`,
  );
  return easings[key];
}
const nameOf = (value, what) => {
  assert(
    typeof value === 'string' && NAME.test(value),
    'INVALID_TARGET',
    `${what} must be a short name such as 'frame' or 'bar3'.`,
  );
  return value;
};

/** A named set of topic colours, so one idea keeps one accent across a page. */
export function topics(map) {
  assert(map && typeof map === 'object' && !Array.isArray(map), 'INVALID_TOPICS', 'Give topics as {name: colour}.');
  const entries = Object.entries(map);
  assert(entries.length > 0 && entries.length <= 64, 'INVALID_TOPICS', 'Use between 1 and 64 topics.');
  const colors = {};
  for (const [name, color] of entries) {
    nameOf(name, 'A topic');
    const c = toHSLA(color);
    colors[name] = hsla(c.h, c.s, c.l, c.a);
  }
  Object.freeze(colors);
  return Object.freeze({
    names: Object.freeze(Object.keys(colors)),
    colors,
    color(name) {
      assert(Object.hasOwn(colors, name), 'UNKNOWN_TOPIC', `No topic named ${String(name)}. Add it to topics().`);
      return colors[name];
    },
    has: (name) => Object.hasOwn(colors, name),
  });
}

/**
 * Create an emphasis track. Call on(target, {...}) for each moment of emphasis and off({...})
 * to let the context return. Targets are names; adapters map names to elements or handles.
 */
export function emphasis(spec = {}) {
  options(spec, ['palette', 'recede', 'duration', 'ease', 'scale', 'lift', 'contrast'], 'emphasis');
  const palette = spec.palette === undefined ? null : spec.palette;
  assert(
    palette === null || (palette && typeof palette.color === 'function' && Array.isArray(palette.names)),
    'INVALID_TOPICS',
    'Pass a palette made with topics().',
  );
  const recede = recedeSpec(spec.recede, DEFAULT_RECEDE);
  const duration = number(spec.duration ?? 0.45, 'emphasis duration', 0, 30);
  const ease = easing(spec.ease);
  const scale = number(spec.scale ?? 1, 'emphasis scale', 0.5, 3);
  const lift = number(spec.lift ?? 0, 'emphasis lift', -1000, 1000);
  let contrast = null;
  if (spec.contrast !== undefined) {
    options(spec.contrast, ['text', 'background', 'floor'], 'emphasis contrast');
    contrast = Object.freeze({
      text: toRGBA(spec.contrast.text),
      background: toRGBA(spec.contrast.background),
      floor: number(spec.contrast.floor ?? 4.5, 'contrast floor', 1, 21),
    });
  }
  const events = [];
  const add = (event) => {
    assert(events.length < 2000, 'RESOURCE_LIMIT', 'An emphasis track holds at most 2000 events.');
    assert(
      !events.some((e) => e.at === event.at),
      'EMPHASIS_OVERLAP',
      `Two emphasis changes at ${event.at}s. Give each its own time.`,
    );
    events.push(Object.freeze(event));
    events.sort((a, b) => a.at - b.at);
  };
  const ramp = (t, from, length) =>
    length <= 0 ? (t >= from ? 1 : 0) : ease(Math.min(1, Math.max(0, (t - from) / length)));

  const track = {
    get events() {
      return Object.freeze([...events]);
    },
    recede,
    palette,
    /** Emphasise one target or several at `at` seconds. The previous emphasis hands over directly. */
    on(target, s = {}) {
      options(s, ['topic', 'at', 'duration', 'recede', 'scale', 'lift'], 'emphasis on');
      const targets = (Array.isArray(target) ? target : [target]).map((t) => nameOf(t, 'An emphasis target'));
      assert(
        targets.length > 0 && targets.length <= 256,
        'INVALID_TARGET',
        'Emphasise between 1 and 256 targets at once.',
      );
      let topic = null;
      if (s.topic !== undefined) {
        assert(palette, 'UNKNOWN_TOPIC', 'Pass palette: topics({...}) to emphasis() before naming a topic.');
        palette.color(s.topic);
        topic = s.topic;
      }
      add({
        kind: 'on',
        targets: Object.freeze(targets),
        topic,
        at: number(s.at ?? 0, 'emphasis time', 0, 86400),
        duration: number(s.duration ?? duration, 'emphasis duration', 0, 30),
        recede: recedeSpec(s.recede, recede),
        scale: number(s.scale ?? scale, 'emphasis scale', 0.5, 3),
        lift: number(s.lift ?? lift, 'emphasis lift', -1000, 1000),
      });
      return track;
    },
    /** End emphasis at `at`: the target settles and the context returns. */
    off(s = {}) {
      options(s, ['at', 'duration'], 'emphasis off');
      add({
        kind: 'off',
        at: number(s.at ?? 0, 'emphasis time', 0, 86400),
        duration: number(s.duration ?? duration, 'emphasis duration', 0, 30),
      });
      return track;
    },
    /**
     * The emphasis state at `time`: how strongly each target is emphasised (0 to 1), how far the
     * context has receded, and the recede settings in force.
     */
    state(time) {
      number(time, 'emphasis time', -86400, 86400);
      const names = new Set(events.flatMap((e) => (e.kind === 'on' ? e.targets : [])));
      const amounts = {},
        topicOf = {},
        scaleOf = {},
        liftOf = {};
      let last = -1;
      while (last + 1 < events.length && events[last + 1].at <= time) last++;
      // Each event moves a value from wherever the previous event left it, so a handover that
      // starts mid-ramp continues smoothly instead of jumping.
      const fold = (step) => {
        let v = 0;
        for (let j = 0; j <= last; j++) {
          const until = j < last ? events[j + 1].at : time;
          v = step(events[j], v, ramp(until, events[j].at, events[j].duration));
        }
        return v;
      };
      for (const name of names) {
        const a = fold((e, v, r) => (e.kind === 'on' && e.targets.includes(name) ? v + (1 - v) * r : v * (1 - r)));
        if (a <= 0) continue;
        amounts[name] = a;
        for (let j = last; j >= 0; j--)
          if (events[j].kind === 'on' && events[j].targets.includes(name)) {
            topicOf[name] = events[j].topic;
            scaleOf[name] = events[j].scale;
            liftOf[name] = events[j].lift;
            break;
          }
      }
      // The context stays receded through a handover, so the page never flashes back to neutral.
      const contextAmount = fold((e, v, r) => (e.kind === 'on' ? v + (1 - v) * r : v * (1 - r)));
      let active = null;
      for (let j = last; j >= 0 && !active; j--) if (events[j].kind === 'on') active = events[j];
      return Object.freeze({
        time,
        targets: Object.freeze(amounts),
        topics: Object.freeze(topicOf),
        scales: Object.freeze(scaleOf),
        lifts: Object.freeze(liftOf),
        context: contextAmount,
        recede: active ? active.recede : recede,
      });
    },
    /** Paint for a target at `time`, mixing its own colour toward its topic accent. */
    targetStyle(name, time, base = {}) {
      options(base, ['color'], 'emphasis target base');
      const st = track.state(time),
        a = st.targets[name] ?? 0;
      const topic = st.topics[name];
      const accent = topic && palette ? palette.color(topic) : null;
      const color = base.color === undefined ? accent : accent ? mix(base.color, accent, a) : toHex(base.color);
      return Object.freeze({
        amount: a,
        topic: topic ?? null,
        color: color ?? null,
        scale: 1 + ((st.scales[name] ?? 1) - 1) * a,
        lift: (st.lifts[name] ?? 0) * a,
      });
    },
    /** How a context item looks at `time`: opacity multiplier, desaturation and blur. */
    contextStyle(time, base = {}) {
      options(base, ['color'], 'emphasis context base');
      const st = track.state(time),
        c = st.context,
        r = st.recede;
      let color = null;
      if (base.color !== undefined) {
        const h = toHSLA(base.color);
        color = toHex(hsla(h.h, h.s * (1 - r.desaturate * c), h.l, h.a));
      }
      return Object.freeze({
        amount: c,
        opacity: 1 - (1 - r.opacity) * c,
        desaturate: r.desaturate * c,
        blur: r.blur * c,
        color,
      });
    },
    /**
     * Check that receded context text stays readable. Compares the context text colour,
     * composited at the most receded opacity over the background, against the floor.
     */
    audit() {
      const findings = [];
      if (contrast) {
        const levels = new Set([recede.opacity, ...events.filter((e) => e.kind === 'on').map((e) => e.recede.opacity)]);
        for (const opacity of levels) {
          const alpha = contrast.text[3] * opacity;
          const shown = [0, 1, 2].map((i) => contrast.text[i] * alpha + contrast.background[i] * (1 - alpha));
          const ratio = contrastRGB(shown, contrast.background);
          if (ratio < contrast.floor)
            findings.push(
              Object.freeze({
                code: 'RECEDE_TOO_FAINT',
                opacity,
                ratio,
                floor: contrast.floor,
                message: `Context text at opacity ${opacity} has contrast ${ratio.toFixed(2)}:1, below ${contrast.floor}:1. Recede less.`,
              }),
            );
        }
      }
      return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) });
    },
  };
  return Object.freeze(track);
}

/**
 * Find words in token elements (for example kineticText tokens) and group them by target name,
 * so emphasis survives text splitting. `terms` maps a target name to a word or phrase.
 */
export function tagTokens(tokens, terms) {
  assert(
    Array.isArray(tokens) && tokens.length <= 20000,
    'INVALID_TARGET',
    'Pass an array of at most 20000 token elements.',
  );
  assert(
    terms && typeof terms === 'object' && !Array.isArray(terms),
    'INVALID_TARGET',
    'Give terms as {target: "word or phrase"}.',
  );
  const words = tokens.map((t) => {
    assert(t && typeof t.textContent === 'string', 'INVALID_TARGET', 'Each token must be an element with text.');
    return t.textContent
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}'-]/gu, '');
  });
  const out = {};
  for (const [name, phrase] of Object.entries(terms)) {
    nameOf(name, 'A term target');
    const parts = text(phrase, 'term', 200)
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ''));
    const found = [];
    for (let i = 0; i + parts.length <= words.length; i++) {
      // Tokens may include whitespace tokens; compare against the next non-empty words.
      const run = [];
      let j = i;
      while (run.length < parts.length && j < words.length) {
        if (words[j]) run.push(j);
        j++;
      }
      if (run.length === parts.length && run.every((w, k) => words[w] === parts[k]) && words[i])
        found.push(...run.map((w) => tokens[w]));
    }
    out[name] = Object.freeze([...new Set(found)]);
  }
  return Object.freeze(out);
}

/**
 * Apply an emphasis track to existing DOM elements. `targets` maps names to elements; every
 * element in `context` recedes. `ink` is the normal text colour that targets mix from.
 * Call update(time) yourself or pass a player whose frame events supply time.
 */
export function emphasizeDOM(track, spec = {}) {
  options(spec, ['targets', 'context', 'ink', 'player'], 'emphasizeDOM');
  assert(track && typeof track.state === 'function', 'INVALID_TARGET', 'Pass a track made with emphasis().');
  const isElement = (el) => el && el.nodeType === 1 && el.style && typeof el.getAttribute === 'function';
  const targets = Object.entries(spec.targets ?? {}).map(([name, els]) => {
    nameOf(name, 'A DOM target');
    const list = Array.isArray(els) ? els : [els];
    assert(list.every(isElement), 'INVALID_TARGET', `Target ${name} must be elements.`);
    return [name, list];
  });
  const context = spec.context ?? [];
  assert(Array.isArray(context) && context.every(isElement), 'INVALID_TARGET', 'context must be an array of elements.');
  const ink = spec.ink === undefined ? null : toHex(spec.ink);
  const all = [...new Set([...targets.flatMap(([, l]) => l), ...context])];
  assert(all.length <= 20000, 'RESOURCE_LIMIT', 'Emphasise at most 20000 elements.');
  const original = new Map(all.map((el) => [el, el.getAttribute('style')]));
  let disposed = false,
    unsubscribe = [];
  const apply = (time) => {
    assert(!disposed, 'DISPOSED', 'This emphasis binding was disposed.');
    const targetSet = new Set();
    for (const [name, list] of targets) {
      const st = track.targetStyle(name, time, ink ? { color: ink } : {});
      for (const el of list) {
        targetSet.add(el);
        if (st.color && st.amount > 0) el.style.setProperty('color', st.color);
        else el.style.removeProperty?.('color');
        el.style.setProperty('opacity', '1');
        el.style.setProperty('filter', 'none');
        el.style.setProperty('transform', st.amount > 0 ? `translateY(${-st.lift}px) scale(${st.scale})` : 'none');
      }
    }
    const cs = track.contextStyle(time);
    for (const el of context) {
      if (targetSet.has(el)) continue;
      el.style.setProperty('opacity', String(Math.round(cs.opacity * 1000) / 1000));
      const filters = [];
      if (cs.desaturate > 0) filters.push(`saturate(${Math.round((1 - cs.desaturate) * 1000) / 1000})`);
      if (cs.blur > 0) filters.push(`blur(${Math.round(cs.blur * 100) / 100}px)`);
      el.style.setProperty('filter', filters.length ? filters.join(' ') : 'none');
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const off of unsubscribe) off();
    unsubscribe = [];
    for (const [el, style] of original) style === null ? el.removeAttribute('style') : el.setAttribute('style', style);
  };
  if (spec.player !== undefined) {
    assert(typeof spec.player.on === 'function', 'INVALID_PLAYER', 'A player must offer on(event, fn).');
    unsubscribe.push(spec.player.on('frame', (f) => apply(f.time)));
    unsubscribe.push(spec.player.on('dispose', dispose));
  }
  return Object.freeze({
    update: apply,
    dispose,
    get disposed() {
      return disposed;
    },
  });
}

/**
 * Bind an emphasis track to scene handles through ordinary bindings, so the scene's own
 * sampling, seeking and export see it. Each target entry is {handle, fill}; each context
 * entry is {handle, fill?, opacity?}. release() unbinds every property it bound.
 */
export function emphasizeScene(track, spec = {}) {
  options(spec, ['targets', 'context'], 'emphasizeScene');
  assert(track && typeof track.state === 'function', 'INVALID_TARGET', 'Pass a track made with emphasis().');
  const isHandle = (h) => h && typeof h.bind === 'function' && typeof h.unbind === 'function';
  const bound = [];
  const bind = (handle, props, map) => {
    handle.bind(props, { inputs: [], map });
    bound.push([handle, props]);
  };
  try {
    for (const [name, entries] of Object.entries(spec.targets ?? {})) {
      nameOf(name, 'A scene target');
      for (const entry of Array.isArray(entries) ? entries : [entries]) {
        options(entry, ['handle', 'fill', 'scale'], 'scene emphasis target');
        assert(isHandle(entry.handle), 'INVALID_TARGET', `Target ${name} needs a scene handle.`);
        const fill = entry.fill === undefined ? null : toHex(entry.fill);
        const props = fill ? ['fill', 'scaleX', 'scaleY'] : ['scaleX', 'scaleY'];
        bind(entry.handle, props, (ctx) => {
          const st = track.targetStyle(name, ctx.time, fill ? { color: fill } : {});
          const s = st.scale;
          return fill ? { fill: st.color ?? fill, scaleX: s, scaleY: s } : { scaleX: s, scaleY: s };
        });
      }
    }
    for (const entry of spec.context ?? []) {
      options(entry, ['handle', 'fill', 'opacity'], 'scene emphasis context');
      assert(isHandle(entry.handle), 'INVALID_TARGET', 'Each context entry needs a scene handle.');
      const fill = entry.fill === undefined ? null : toHex(entry.fill);
      const opacity = number(entry.opacity ?? 1, 'context opacity', 0, 1);
      bind(entry.handle, fill ? ['opacity', 'fill'] : ['opacity'], (ctx) => {
        const cs = track.contextStyle(ctx.time, fill ? { color: fill } : {});
        return fill ? { opacity: opacity * cs.opacity, fill: cs.color } : { opacity: opacity * cs.opacity };
      });
    }
  } catch (error) {
    for (const [h, props] of bound) for (const p of props) h.unbind(p);
    throw error;
  }
  let released = false;
  return Object.freeze({
    release() {
      if (released) return;
      released = true;
      for (const [h, props] of bound) for (const p of props) h.unbind(p);
    },
  });
}
