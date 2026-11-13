import { assert, number, text, options, KitError } from '../core/validate.js';
import { textOutline } from '../import/font.js';
import { validatePaint } from '../graphics/index.js';
import { rgbaOf } from '../graphics/cloud.js';
import { easings } from '../core/timing.js';
import { Derived } from '../core/scene.js';
import { Ambient } from '../core/ambient.js';
import { DataSource } from '../core/data.js';
import { lattice } from '../geometry/deform.js';
import { localMatrix, multiplyAffine } from '../core/transform.js';
import { invertMatrix } from '../camera/math.js';
import { prepareHoldAttachment } from '../characters/holding.js';
import {
  isStrokeSymbol as isSymbol,
  strokeParts,
  blendParts,
  barCommands,
  partsCommands,
  barParameters,
} from './glyph-symbols.js';
import { glyphEditSegments } from './glyph-edit.js';
import {
  registerGlyph,
  glyphRecord,
  snapshotOwn,
  ownMatrix,
  lineWorld,
  affineProps,
  lifecycleAt,
  liftGlyph,
  freeCarrier,
  isFreeAt,
} from './glyph-lifecycle.js';
let nextId = 0;
/** @typedef {{at?:number,duration?:number,ease?:string|((progress:number)=>number)}} GlyphEdit */
const progress = (fn, t) => {
  try {
    return number(fn(t), 'glyph easing');
  } catch (cause) {
    if (cause instanceof KitError) throw cause;
    const error = new KitError('EASING_FAILED', 'Glyph easing callback failed.');
    error.cause = cause;
    throw error;
  }
};
const curve = (spec) => {
  const name = spec.ease ?? 'smooth';
  assert(
    typeof name === 'function' || (typeof name === 'string' && Object.hasOwn(easings, name)),
    'INVALID_EASING',
    'Use a named easing or trusted progress function.',
  );
  return typeof name === 'function' ? name : easings[name];
};
const clamp = (value) => Math.max(0, Math.min(1, value));
const translate = (x) => [1, 0, 0, 1, x, 0];
/** Imported glyph objects, measured edits, driven gaps and pure time-authored transfers. */
export function glyphs(scene, value, spec) {
  options(spec, ['font', 'size', 'x', 'y', 'fill', 'letterSpacing', 'missing'], 'glyph line');
  assert(scene && typeof scene.group === 'function', 'INVALID_GLYPHS', 'Use a scene.');
  text(value, 'glyph text', 4096);
  const font = spec.font,
    size = number(spec.size ?? 72, 'glyph size', 1, 1000),
    spacing = number(spec.letterSpacing ?? 0, 'glyph spacing', -10000, 10000),
    missing = spec.missing ?? 'error',
    x = number(spec.x ?? 0, 'glyph x'),
    y = number(spec.y ?? 0, 'glyph y'),
    fill = validatePaint(spec.fill ?? '#132d3c');
  textOutline(font, '', { size, missing });
  scene.component({ type: 'text', props: { fill } });
  const symbolLength = textOutline(font, '=', { size, missing: 'notdef' }).advance * 0.82,
    records = [],
    events = [],
    gaps = new Map(),
    outlines = new Map(),
    kernings = new Map();
  let sequence = [],
    group,
    revision = 0,
    api;
  const context = (time) => (typeof time === 'object' ? time : scene._sampleContext({ time }));
  const outline = (char) => {
    if (!outlines.has(char)) {
      const result = textOutline(font, char, { size, missing: isSymbol(char) ? 'notdef' : missing });
      outlines.set(char, {
        advance: result.advance,
        commands: isSymbol(char) ? partsCommands(strokeParts(char, symbolLength, size)) : result.commands,
      });
    }
    return outlines.get(char);
  };
  const prepare = (source) =>
    Array.from(source).map((char) => ({
      id: ++nextId,
      char,
      ...outline(char),
      handle: null,
      layout: null,
      morphs: [],
      deformed: false,
      scene,
      font,
      size,
      life: [],
      lifted: false,
      parts: null,
      baseParts: isSymbol(char) ? strokeParts(char, symbolLength, size) : null,
      authoredOwner: null,
    }));
  const copy = (seq) => seq.map((row) => ({ record: row.record, char: row.char }));
  const inputValue = (input, c) =>
    input instanceof DataSource
      ? input.rows
      : input instanceof Derived
        ? input.sample(c)
        : input.sample(input instanceof Ambient ? (c.ambient ?? 0) : c.time);
  const read = (input) => (c) => number(inputValue(input, c), 'glyph gap', 0, 1e5);
  const layout = (seq, c, gapMap = gaps) => {
    const positions = new Map();
    let offset = 0;
    seq.forEach((row, i) => {
      const previous = i ? seq[i - 1] : null,
        key = previous ? previous.char + '\0' + row.char : null;
      let pair = 0;
      if (previous && !isSymbol(previous.char) && !isSymbol(row.char)) {
        if (!kernings.has(key))
          kernings.set(
            key,
            textOutline(font, previous.char + row.char, { size, missing }).glyphs[1].x - outline(previous.char).advance,
          );
        pair = kernings.get(key);
      }
      offset += pair + (gapMap.get(row.record.id)?.(c) ?? 0);
      const advance = outline(row.char).advance;
      positions.set(row.record.id, { x: number(offset, 'glyph position'), advance });
      offset += advance + (i < seq.length - 1 ? spacing : 0);
      number(offset, 'glyph line extent');
    });
    offset += gapMap.get(null)?.(c) ?? 0;
    return { positions, width: number(offset, 'glyph line width') };
  };
  const initialRecords = prepare(value);
  assert(initialRecords.length <= 2048, 'RESOURCE_LIMIT', 'A glyph line is limited to 2048 historical glyphs.');
  records.push(...initialRecords);
  sequence = records.map((record) => ({ record, char: record.char }));
  const initial = copy(sequence);
  layout(initial, context(0));
  scene._capacity(1 + records.length * 2);
  function sample(time = 0) {
    const c = context(time);
    number(c.time, 'glyph sample time', 0, 86400);
    let active = null,
      current = initial;
    for (const event of events) {
      if (c.time < event.at) break;
      if (c.time < event.end) {
        active = event;
        break;
      }
      current = event.to;
    }
    const target = active?.to ?? current,
      base = active?.from ?? current,
      a = layout(base, c),
      b = active ? layout(target, c) : a;
    const elapsed = active ? c.time - active.at : 0,
      reflow =
        active?.mode === 'fadeThenClose'
          ? elapsed <= active.fade
            ? 0
            : active.close
              ? clamp(progress(active.ease, (elapsed - active.fade) / active.close))
              : 1
          : active
            ? active.duration
              ? clamp(progress(active.ease, elapsed / active.duration))
              : 1
            : 1;
    const k = reflow,
      deathOpacity =
        active?.mode === 'fadeThenClose'
          ? active.fade
            ? 1 - clamp(progress(active.ease, elapsed / active.fade))
            : 0
          : active?.mode === 'instant'
            ? 0
            : 1 - k,
      birthOpacity = active?.mode === 'instant' ? 1 : k;
    const fromIds = new Map(base.map((row) => [row.record.id, row])),
      toIds = new Map(target.map((row) => [row.record.id, row])),
      states = [],
      birthBoundary = new Map(),
      deathBoundary = new Map();
    let boundary = a.width;
    for (let i = target.length - 1; i >= 0; i--) {
      const id = target[i].record.id;
      if (fromIds.has(id)) boundary = a.positions.get(id).x;
      else birthBoundary.set(id, boundary);
    }
    boundary = b.width;
    for (let i = base.length - 1; i >= 0; i--) {
      const id = base[i].record.id;
      if (toIds.has(id)) boundary = b.positions.get(id).x;
      else deathBoundary.set(id, boundary);
    }
    for (const record of records) {
      const before = a.positions.get(record.id),
        after = b.positions.get(record.id),
        presentFrom = fromIds.has(record.id),
        presentTo = toIds.has(record.id),
        weight = presentFrom && presentTo ? 1 : presentTo ? birthOpacity : presentFrom ? deathOpacity : 0,
        occupancy = presentFrom && presentTo ? 1 : presentTo ? k : presentFrom ? 1 - k : 0;
      let pos = before && after ? before.x + (after.x - before.x) * k : ((after ?? before)?.x ?? 0);
      if (active && !before && after) {
        const start = birthBoundary.get(record.id);
        pos = start + (after.x - start) * k;
      }
      if (active && before && !after) pos = before.x + (deathBoundary.get(record.id) - before.x) * k;
      const char =
        (k < 0.5 ? fromIds.get(record.id) : toIds.get(record.id))?.char ??
        toIds.get(record.id)?.char ??
        fromIds.get(record.id)?.char ??
        record.char;
      const scale =
        active?.mode === 'fadeThenClose' && presentFrom && !presentTo
          ? 1
          : active?.mode === 'instant'
            ? weight
            : weight;
      states.push(
        Object.freeze({
          id: record.id,
          handle: record.handle,
          character: char,
          x: pos,
          opacity: weight,
          scaleX: scale,
          advance:
            (before && after
              ? before.advance + (after.advance - before.advance) * k
              : ((before ?? after)?.advance ?? record.advance)) * occupancy,
        }),
      );
    }
    return Object.freeze({
      time: c.time,
      text: target.map((row) => row.char).join(''),
      width: a.width + (b.width - a.width) * k,
      glyphs: Object.freeze(states),
      revision,
    });
  }
  const state = scene.derive([], (c) => ({ byId: new Map(sample(c).glyphs.map((glyph) => [glyph.id, glyph])) }));
  const line = {
    scene,
    font,
    size,
    get group() {
      return group;
    },
    sample,
    world: (c) => lineWorld(scene, group, c),
    slot: (record, c) => state.sample(c).byId.get(record.id),
  };
  const symbolAt = (record, time) => {
    let parts = record.baseParts;
    for (const m of record.morphs) {
      if (time < m.at) break;
      if (time < m.end) return blendParts(m.fromParts, m.toParts, clamp(progress(m.ease, (time - m.at) / m.duration)));
      parts = m.toParts;
    }
    return parts;
  };
  const characterAt = (record, time) => {
    let char = record.char;
    for (const m of record.morphs) {
      if (time < m.at) break;
      char = time < m.end && clamp(progress(m.ease, (time - m.at) / m.duration)) < 0.5 ? m.from : m.to;
    }
    return char;
  };
  const placement = (record, c) => {
    const p = line.slot(record, c),
      world = line.world(c);
    return {
      matrix: multiplyAffine(world.matrix, [p?.scaleX ?? 0, 0, 0, 1, p?.x ?? 0, 0]),
      opacity: world.opacity * (p?.opacity ?? 0),
      free: false,
    };
  };
  function materialize(record) {
    const wrapper = scene.group();
    group.add(wrapper);
    const handle = wrapper.text({
      text: record.char,
      fontSize: size,
      textOutline: record.commands,
      textAdvance: record.advance,
      fill,
    });
    record.handle = handle;
    record.layout = wrapper;
    record.home = line;
    record.authoredOwner = line;
    record.normalPlacement = (c) => placement(record, c);
    registerGlyph(handle, record);
    wrapper.bind(['x', 'opacity', 'scaleX'], {
      inputs: [state],
      map: (frame) => {
        const p = frame.byId.get(record.id);
        return { x: p?.x ?? 0, opacity: p?.opacity ?? 0, scaleX: p?.scaleX ?? 0 };
      },
    });
    handle.bind('text', { map: (c) => characterAt(record, c.time) });
  }
  scene._batch(() => {
    group = scene.group({ x, y });
    for (const record of records) materialize(record);
  });
  function timing(editSpec = {}, extra = []) {
    options(editSpec, ['at', 'duration', 'ease', ...extra], 'glyph edit');
    const at = number(editSpec.at ?? 0, 'glyph edit time', 0, 86400),
      duration = number(editSpec.duration ?? 0.3, 'glyph edit duration', 0, 86400);
    number(at + duration, 'glyph edit end', 0, 86400);
    assert(events.length < 256, 'RESOURCE_LIMIT', 'Use at most 256 glyph edits.');
    assert(
      !events.length || at >= events.at(-1).end,
      'CHANNEL_OWNED',
      'Schedule non-overlapping glyph edits chronologically.',
    );
    const ease = curve(editSpec);
    progress(ease, 0);
    progress(ease, 1);
    return { at, duration, end: at + duration, ease };
  }
  const index = (i, allowEnd = false) => {
    number(i, 'glyph index', 0, sequence.length - (allowEnd ? 0 : 1));
    assert(Number.isInteger(i), 'INVALID_GLYPHS', 'Use an integer glyph index.');
    return i;
  };
  function compileEvent(next, t) {
    const from = copy(sequence),
      to = copy(next);
    layout(from, context(t.at));
    layout(to, context(t.end));
    return { ...t, from, to };
  }
  function publish(next, event) {
    events.push(event);
    sequence = next;
    revision++;
    scene._extend(event.end);
    scene._changed();
  }
  function ensureSymbol(record) {
    assert(
      !record.deformed && (!record.handle._record.bindings.has('textOutline') || record.symbolDriver),
      'CHANNEL_OWNED',
      'A deformed or externally bound outline cannot own stroke parts/morphs.',
    );
    if (!record.symbolDriver) {
      record.handle.bind('textOutline', {
        map: (c) => {
          if (record.parts) {
            partPaint(record, c);
            return [];
          }
          return partsCommands(symbolAt(record, c.time));
        },
      });
      record.symbolDriver = true;
    }
  }
  function morphPlan(record, from, to, t) {
    assert(
      isSymbol(from) && isSymbol(to) && record.baseParts,
      'GLYPH_MORPH_UNSUPPORTED',
      'Named morphs support =, +, − and ×.',
    );
    assert(
      !record.deformed && (!record.handle._record.bindings.has('textOutline') || record.symbolDriver),
      'CHANNEL_OWNED',
      'Release the existing outline driver.',
    );
    return { ...t, from, to, fromParts: symbolAt(record, t.at), toParts: strokeParts(to, symbolLength, size) };
  }
  function lifecycleTiming(record, t) {
    assert(
      record.life.length < 256 && (!record.life.length || t.at >= record.life.at(-1).end),
      'CHANNEL_OWNED',
      'Schedule non-overlapping glyph transfers chronologically.',
    );
    line.world(context(t.at));
    scene._assertLiftRoot(record.layout);
  }
  function removeOptions(edit) {
    options(edit, ['at', 'duration', 'ease', 'style', 'fade', 'close'], 'glyph removal');
    const style = edit.style ?? 'shrink';
    assert(['shrink', 'fadeThenClose'].includes(style), 'INVALID_GLYPHS', 'Use shrink or fadeThenClose removal.');
    if (style === 'shrink') {
      assert(
        edit.fade === undefined && edit.close === undefined,
        'INVALID_GLYPHS',
        'fade/close belong to fadeThenClose.',
      );
      const { style: _style, ...base } = edit;
      void _style;
      return timing(base);
    }
    let fade, close;
    if (edit.duration !== undefined) {
      const total = number(edit.duration, 'removal duration', 0, 86400);
      fade = number(edit.fade ?? (edit.close !== undefined ? total - edit.close : total / 2), 'removal fade', 0, total);
      close = number(edit.close ?? total - fade, 'removal close', 0, total);
      assert(Math.abs(fade + close - total) < 1e-9, 'INVALID_GLYPHS', 'fade + close must equal duration.');
    } else {
      fade = number(edit.fade ?? 0.15, 'removal fade', 0, 86400);
      close = number(edit.close ?? 0.15, 'removal close', 0, 86400);
    }
    return {
      ...timing({ at: edit.at ?? 0, duration: fade + close, ease: edit.ease }),
      mode: 'fadeThenClose',
      fade,
      close,
    };
  }
  api = {
    group,
    get handles() {
      return Object.freeze(sequence.map((row) => row.record.handle));
    },
    get characters() {
      return Object.freeze(sequence.map((row) => row.char));
    },
    sample,
    insert(i, source, edit = {}) {
      index(i, true);
      text(source, 'inserted glyphs', 4096);
      assert(source.length, 'INVALID_GLYPHS', 'Insert at least one glyph.');
      const t = timing(edit),
        added = prepare(source);
      assert(
        records.length + added.length <= 2048,
        'RESOURCE_LIMIT',
        'A glyph line is limited to 2048 historical glyphs.',
      );
      scene._capacity(added.length * 2);
      const next = [
          ...sequence.slice(0, i),
          ...added.map((record) => ({ record, char: record.char })),
          ...sequence.slice(i),
        ],
        planned = compileEvent(next, t);
      scene._batch(() => {
        records.push(...added);
        for (const record of added) materialize(record);
        publish(next, planned);
      });
      return api;
    },
    remove(i, edit = {}) {
      index(i);
      const t = removeOptions(edit),
        next = sequence.filter((_, j) => j !== i),
        planned = compileEvent(next, t);
      publish(next, planned);
      return api;
    },
    morph(i, to, edit = {}) {
      index(i);
      const row = sequence[i],
        record = row.record,
        t = timing(edit),
        morph = morphPlan(record, row.char, to, t),
        next = copy(sequence);
      next[i].char = to;
      const planned = compileEvent(next, t);
      scene._batch(() => {
        ensureSymbol(record);
        record.morphs.push(morph);
        publish(next, planned);
      });
      return api;
    },
    gap(i, width) {
      index(i, true);
      let driver;
      if (typeof width === 'number') {
        const amount = number(width, 'glyph gap', 0, 1e5);
        driver = () => amount;
      } else if (scene._ownsInput(width)) {
        assert(
          !(width instanceof DataSource),
          'INVALID_BINDING',
          'A direct glyph gap needs a scalar scene input. Map data rows through a binding.',
        );
        driver = read(width);
      } else {
        options(width, ['inputs', 'map'], 'glyph gap binding');
        assert(typeof width.map === 'function', 'INVALID_BINDING', 'A gap binding needs a map.');
        const map = width.map,
          inputs = width.inputs ?? [];
        assert(Array.isArray(inputs) && inputs.length <= 64, 'RESOURCE_LIMIT', 'Use at most64 gap inputs.');
        const captured = Array.from({ length: inputs.length }, (_, j) => {
          const d = Object.getOwnPropertyDescriptor(inputs, j);
          assert(
            d && 'value' in d && scene._ownsInput(d.value),
            'INVALID_BINDING',
            'Gap inputs must belong to the same scene.',
          );
          return d.value;
        });
        driver = (c) => {
          try {
            return number(map(...captured.map((input) => inputValue(input, c)), c), 'glyph gap', 0, 1e5);
          } catch (cause) {
            if (cause instanceof KitError) throw cause;
            const error = new KitError('BINDING_FAILED', 'Glyph gap callback failed.');
            error.cause = cause;
            throw error;
          }
        };
      }
      const anchor = i === sequence.length ? null : sequence[i].record.id,
        next = new Map(gaps);
      next.set(anchor, driver);
      layout(sequence, context(0), next);
      gaps.set(anchor, driver);
      revision++;
      scene._changed();
      return api;
    },
    to(source, edit = {}) {
      text(source, 'target glyph text', 4096);
      options(edit, ['at', 'duration', 'ease', 'swap', 'pivots'], 'glyph text edit');
      const swap = edit.swap ?? 'grow';
      assert(['instant', 'grow'].includes(swap), 'INVALID_GLYPHS', 'swap is instant or grow.');
      const { swap: _swap, pivots, ...base } = edit;
      void _swap;
      const t = timing(base),
        segments = glyphEditSegments(sequence, Array.from(source), pivots),
        added = [],
        morphs = [],
        next = [];
      for (const { old, target, prefix, suffix, pivot } of segments) {
        next.push(...old.slice(0, prefix).map((row) => ({ ...row })));
        const middle = target.slice(prefix, target.length - suffix);
        for (let j = 0; j < middle.length; j++) {
          const prior = old[prefix + j],
            char = middle[j];
          if (
            j < old.length - prefix - suffix &&
            prior &&
            (prior.char === char || (isSymbol(prior.char) && isSymbol(char)))
          ) {
            next.push({ record: prior.record, char });
            if (prior.char !== char) morphs.push([prior.record, morphPlan(prior.record, prior.char, char, t)]);
          } else {
            const record = prepare(char)[0];
            added.push(record);
            next.push({ record, char });
          }
        }
        next.push(...old.slice(old.length - suffix).map((row) => ({ ...row })));
        if (pivot) next.push({ ...pivot });
      }
      assert(
        records.length + added.length <= 2048,
        'RESOURCE_LIMIT',
        'A glyph line is limited to2048 historical glyphs.',
      );
      scene._capacity(added.length * 2);
      const planned = compileEvent(next, { ...t, mode: swap === 'instant' ? 'instant' : undefined });
      scene._batch(() => {
        records.push(...added);
        for (const record of added) materialize(record);
        for (const [record, morph] of morphs) {
          ensureSymbol(record);
          record.morphs.push(morph);
        }
        publish(next, planned);
      });
      return api;
    },
    clone(i, edit = {}) {
      index(i);
      options(edit, ['at'], 'glyph clone');
      const at = number(edit.at ?? 0, 'glyph clone time', 0, 86400),
        c = context(at),
        source = sequence[i].record,
        located = scene.locate(source.handle, { time: c }),
        sourceNode = scene._evaluateOwn(source.handle._record, c);
      line.world(c);
      scene._assertLiftRoot(source.layout);
      assert(
        !sourceNode.clipTarget &&
          !sourceNode.props.clip &&
          !sourceNode.props.mask &&
          !sourceNode.props.blur &&
          !sourceNode.props.glow &&
          !sourceNode.props.shade &&
          !sourceNode.props.texture &&
          (sourceNode.props.blend ?? 'normal') === 'normal',
        'GLYPH_LIFECYCLE_UNSUPPORTED',
        'Clone prepared glyph ink without filters, masks or clips.',
      );
      assert(
        located.visible || source.parts?.some((part) => !isFreeAt(part, at)),
        'GLYPH_NOT_VISIBLE',
        'Clone a visible source glyph.',
      );
      assert(Array.from(sourceNode.props.text).length === 1, 'INVALID_GLYPHS', 'Clone one semantic glyph at a time.');
      assert(records.length < 2048, 'RESOURCE_LIMIT', 'A glyph line is limited to2048 historical glyphs.');
      scene._capacity(2);
      const record = prepare(sourceNode.props.text)[0];
      record.commands = source.parts
        ? source.parts
            .filter((part) => !isFreeAt(part, at))
            .flatMap((part) => {
              const props = scene._evaluateOwn(part.handle._record, c).props;
              assert(
                props.opacity === 1,
                'GLYPH_LIFECYCLE_UNSUPPORTED',
                'Prepare separately translucent parts before cloning their glyph.',
              );
              const m = multiplyAffine(invertMatrix(located.matrix), scene.locate(part.handle, { time: c }).matrix);
              return props.commands.map((command) => {
                const next = [command[0]];
                for (let j = 1; j < command.length; j += 2)
                  next.push(
                    m[0] * command[j] + m[2] * command[j + 1] + m[4],
                    m[1] * command[j] + m[3] * command[j + 1] + m[5],
                  );
                return next;
              });
            })
        : sourceNode.props.textOutline;
      record.advance = sourceNode.props.textAdvance ?? record.advance;
      record.baseParts =
        isSymbol(record.char) &&
        source.baseParts &&
        !source.parts &&
        !source.deformed &&
        (source.symbolDriver ||
          (!source.handle._record.bindings.has('textOutline') && !source.handle._record.tracks.has('textOutline')))
          ? symbolAt(source, at).map((p) => ({ ...p }))
          : null;
      scene._batch(() => {
        records.push(record);
        materialize(record);
        record.authoredOwner = null;
        record.life.push({
          kind: 'free',
          at,
          end: at,
          matrix: located.matrix,
          opacity: Math.min(1, located.opacity / (sourceNode.props.opacity || 1)),
        });
        record.handle.set(
          Object.fromEntries(
            [
              'opacity',
              'fill',
              'fillOpacity',
              'stroke',
              'strokeOpacity',
              'strokeWidth',
              'strokeDasharray',
              'strokeDashoffset',
              'strokeLinecap',
              'strokeLinejoin',
              'strokeMiterlimit',
              'fillRule',
              'halo',
              'fontFamily',
              'fontWeight',
              'letterSpacing',
              'align',
              'baseline',
            ]
              .filter((key) => sourceNode.props[key] !== undefined)
              .map((key) => [key, sourceNode.props[key]]),
          ),
        );
        liftGlyph(record);
        revision++;
        scene._extend(at);
        scene._changed();
      });
      return record.handle;
    },
    detach(i, edit = {}) {
      if (typeof i !== 'number') return detachPart(i, edit);
      index(i);
      const record = sequence[i].record,
        t = timing(edit),
        c = context(t.at);
      lifecycleTiming(record, t);
      const carrier = freeCarrier(record, c),
        next = sequence.filter((_, j) => j !== i),
        planned = compileEvent(next, t);
      scene._batch(() => {
        record.life.push({ kind: 'free', at: t.at, end: t.at, matrix: carrier.matrix, opacity: carrier.opacity });
        record.authoredOwner = null;
        liftGlyph(record);
        publish(next, planned);
      });
      return record.handle;
    },
    attach(handle, i, edit = {}) {
      const record = glyphRecord(handle);
      assert(record && record.scene === scene, 'INVALID_GLYPH_HANDLE', 'Attach a free glyph from this scene.');
      if (record.partOwner) return attachPart(record, i, edit);
      index(i, true);
      assert(record.authoredOwner === null, 'CHANNEL_OWNED', 'Detach a glyph before attaching it to a line.');
      assert(
        record.font === font && record.size === size,
        'GLYPH_ATTACH_FONT',
        'Attach glyphs with the same captured font and size.',
      );
      const t = timing(edit),
        c = context(t.at);
      lifecycleTiming(record, t);
      const commitHold = prepareHoldAttachment(handle, t.at, t.end),
        located = scene.locate(handle, { time: c }),
        own = snapshotOwn(handle);
      ownMatrix(scene, own, c);
      const next = [...sequence.slice(0, i), { record, char: characterAt(record, t.at) }, ...sequence.slice(i)],
        planned = compileEvent(next, t);
      assert(
        records.includes(record) || records.length < 2048,
        'RESOURCE_LIMIT',
        'A glyph line is limited to2048 historical glyphs.',
      );
      const event = {
        kind: 'attach',
        ...t,
        from: located.matrix,
        opacity: located.opacity / (scene._evaluateOwn(own, c).props.opacity || 1),
        own,
        target: (ctx) => {
          const p = line.slot(record, ctx),
            world = line.world(ctx);
          return { matrix: multiplyAffine(world.matrix, translate(p?.x ?? 0)), opacity: world.opacity };
        },
      };
      scene._batch(() => {
        commitHold();
        if (!records.includes(record)) records.push(record);
        record.life.push(event);
        record.authoredOwner = line;
        liftGlyph(record);
        publish(next, planned);
      });
      return api;
    },
    parts(i) {
      index(i);
      const record = sequence[i].record;
      assert(
        isSymbol(sequence[i].char) && record.baseParts,
        'GLYPH_PARTS_UNSUPPORTED',
        'Stroke parts belong to =, +, − or ×.',
      );
      assert(!record.deformed, 'CHANNEL_OWNED', 'Deformed glyphs do not expose canonical stroke parts.');
      if (!record.parts) makeParts(record);
      return Object.freeze(record.parts.slice(0, sequence[i].char === '−' ? 1 : 2).map((p) => p.handle));
    },
    deform(i, config = {}) {
      index(i);
      const record = sequence[i].record;
      assert(
        !record.deformed &&
          !record.morphs.length &&
          !record.parts &&
          !record.handle._record.bindings.has('textOutline') &&
          !record.handle._record.tracks.has('textOutline'),
        'CHANNEL_OWNED',
        'Glyph outline already has a deformation or morph driver.',
      );
      assert(record.commands.length, 'INVALID_DEFORMATION', 'An empty glyph cannot be deformed.');
      const result = lattice(scene, record.commands, config);
      record.handle.bind('textOutline', { inputs: [result.commands], map: (commands) => commands });
      record.deformed = true;
      return result;
    },
  };
  const paintKeys = [
    'fill',
    'fillOpacity',
    'stroke',
    'strokeOpacity',
    'strokeWidth',
    'strokeDasharray',
    'strokeDashoffset',
    'strokeLinecap',
    'strokeLinejoin',
    'strokeMiterlimit',
    'fillRule',
  ];
  function partPaint(record, c) {
    const snapshot = snapshotOwn(record.handle);
    snapshot.bindings.delete('textOutline');
    snapshot.tracks.delete('textOutline');
    const p = scene._evaluateOwn(snapshot, c).props;
    assert(
      typeof p.fill === 'string' &&
        (p.fill === 'none' || rgbaOf(p.fill)[3] === 1) &&
        p.fillOpacity === 1 &&
        p.opacity === 1 &&
        (p.stroke === 'none' || p.strokeWidth === 0) &&
        !p.halo &&
        !p.clip &&
        !p.mask &&
        !p.blur &&
        !p.glow &&
        !p.shade &&
        !p.texture &&
        (p.blend ?? 'normal') === 'normal',
      'GLYPH_PARTS_UNSUPPORTED',
      'Stroke parts require opaque solid fill without outlines, halos, clips or effects. Keep the compound glyph for translucent/gradient/stroked artwork.',
    );
    return Object.fromEntries(paintKeys.map((key) => [key, p[key]]));
  }
  function makeParts(record) {
    partPaint(record, context(0));
    scene._capacity(4);
    assert(
      !record.handle._record.bindings.has('textOutline') || record.symbolDriver,
      'CHANNEL_OWNED',
      'Release the glyph outline binding before exposing parts.',
    );
    const result = [];
    scene._batch(() => {
      ensureSymbol(record);
      for (let partIndex = 0; partIndex < 2; partIndex++) {
        const wrapper = record.layout.group(),
          handle = wrapper.path({ commands: barCommands(symbolAt(record, 0)[partIndex]), fill, stroke: 'none' }),
          part = {
            scene,
            font,
            size,
            id: ++nextId,
            char: record.char,
            handle,
            layout: wrapper,
            life: [],
            lifted: false,
            partOwner: record,
            partIndex,
            authoredOwner: record,
          };
        part.normalPlacement = (c) => {
          const glyph = scene._evaluateOwn(record.handle._record, c),
            carrier = record.lifted ? lifecycleAt(record, c) : record.normalPlacement(c);
          return {
            matrix: multiplyAffine(carrier.matrix, localMatrix(glyph.props, glyph)),
            opacity: carrier.opacity * (glyph.props.opacity ?? 1),
          };
        };
        wrapper.bind(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'opacity'], {
          map: (c) => {
            const node = scene._evaluateOwn(record.handle._record, c);
            return affineProps(localMatrix(node.props, node), node.props.opacity ?? 1);
          },
        });
        handle.bind('commands', {
          map: (c) => {
            let latest = null;
            for (const event of part.life) {
              if (c.time < event.at) break;
              latest = event;
            }
            if (latest?.kind === 'free') return latest.commands;
            const target = symbolAt(record, c.time)[partIndex];
            if (latest?.kind === 'attach' && c.time < latest.end) {
              const k = latest.duration ? clamp(progress(latest.ease, (c.time - latest.at) / latest.duration)) : 1;
              return barCommands(blendParts([latest.fromPart], [target], k)[0]);
            }
            return barCommands(target);
          },
        });
        handle.bind(paintKeys, {
          map: (c) => {
            let latest = null;
            for (const event of part.life) {
              if (c.time < event.at) break;
              latest = event;
            }
            return latest?.kind === 'free' ? latest.paint : partPaint(record, c);
          },
        });
        registerGlyph(handle, part);
        result.push(part);
      }
      record.parts = result;
      revision++;
      scene._changed();
    });
  }
  function detachPart(handle, edit) {
    const part = glyphRecord(handle);
    assert(
      part?.partOwner && part.scene === scene && part.authoredOwner,
      'INVALID_GLYPH_HANDLE',
      'Detach an attached stroke part from this scene.',
    );
    const t = timing(edit);
    lifecycleTiming(part, t);
    const c = context(t.at),
      carrier = freeCarrier(part, c),
      ownProps = scene._evaluateOwn(part.handle._record, c).props,
      commands = ownProps.commands,
      paint = Object.fromEntries(paintKeys.map((key) => [key, ownProps[key]]));
    scene._batch(() => {
      part.life.push({
        kind: 'free',
        at: t.at,
        end: t.at,
        matrix: carrier.matrix,
        opacity: carrier.opacity,
        commands,
        paint,
      });
      part.authoredOwner = null;
      liftGlyph(part);
      revision++;
      scene._extend(t.end);
      scene._changed();
    });
    return handle;
  }
  function attachPart(part, i, edit) {
    index(i);
    assert(sequence[i].record === part.partOwner, 'GLYPH_PART_TARGET', 'Reattach a stroke part to its original glyph.');
    assert(part.authoredOwner === null, 'CHANNEL_OWNED', 'Detach this part before attaching it.');
    const t = timing(edit);
    lifecycleTiming(part, t);
    const c = context(t.at),
      commitHold = prepareHoldAttachment(part.handle, t.at, t.end),
      located = scene.locate(part.handle, { time: c }),
      own = snapshotOwn(part.handle),
      fromPart = barParameters(scene._evaluateOwn(part.handle._record, c).props.commands),
      event = {
        kind: 'attach',
        ...t,
        fromPart,
        from: located.matrix,
        opacity: located.opacity / (scene._evaluateOwn(own, c).props.opacity || 1),
        own,
        target: (ctx) => part.normalPlacement(ctx),
      };
    scene._batch(() => {
      commitHold();
      part.life.push(event);
      part.authoredOwner = part.partOwner;
      liftGlyph(part);
      revision++;
      scene._extend(t.end);
      scene._changed();
    });
    return api;
  }
  return Object.freeze(api);
}
