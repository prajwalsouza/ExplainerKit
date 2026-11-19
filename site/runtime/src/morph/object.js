import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { captureState } from '../core/transition.js';
import { properties } from '../core/geometry.js';
import { localMatrix, resolvePivot } from '../core/transform.js';
import { ellipsePath, roundedRectPath } from '../geometry/index.js';
import { multiplyMatrices, transformPoint } from '../camera/math.js';
import { validateFrame } from '../renderers/shared.js';
import { colorInterpolator } from '../color/interpolate.js';
import { createCompoundMorph } from './compound.js';
import { assignParts } from './assignment.js';
import { describeMathParts, equationPartCost, equationPartAnchor, sameMathOutline } from './semantic.js';

const UNIT = [1, 0, 0, 1, 0, 0];
const MAX_PARTS = 128;
const MAX_CONTOURS = 8;
const MAX_MATCH_COMMANDS = 48000;

function localOutline(node) {
  const p = node.props;
  switch (node.type) {
    case 'path':
      return p.commands;
    case 'circle':
      return p.r > 0 ? ellipsePath({ rx: p.r, ry: p.r }) : null;
    case 'ellipse':
      return p.rx > 0 && p.ry > 0 ? ellipsePath({ rx: p.rx, ry: p.ry }) : null;
    case 'rect':
      return p.width > 0 && p.height > 0 ? roundedRectPath({ width: p.width, height: p.height, radius: p.rx }) : null;
    case 'text':
      return p.textOutline?.length ? p.textOutline : null;
    default:
      return null;
  }
}

function pathData(commands, matrix) {
  const result = [];
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [op, ...values] of commands) {
    const command = [op];
    for (let i = 0; i < values.length; i += 2) {
      const p = transformPoint(matrix, { x: values[i], y: values[i + 1] });
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.max(Math.abs(p.x), Math.abs(p.y)) > 1e7) return null;
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
      command.push(p.x, p.y);
    }
    if (op === 'M') {
      if (result.length >= MAX_CONTOURS) return null;
      result.push({ id: `outline${result.length + 1}`, commands: [] });
    }
    if (!result.length) return null;
    result.at(-1).commands.push(command);
  }
  if (result.some((contour) => contour.commands.at(-1)[0] !== 'Z') || right === left || bottom === top) return null;
  return {
    contours: result,
    center: [(left + right) / 2, (top + bottom) / 2],
    width: right - left,
    height: bottom - top,
  };
}

function endpoint(spec) {
  options(spec, ['frame', 'object', 'keys'], 'object morph endpoint');
  options(spec.frame, ['width', 'height', 'children', 'description', 'light', 'motionBlur'], 'object morph frame');
  const { description, ...frameData } = spec.frame;
  const captured = captureState(frameData);
  const frame =
    description === undefined
      ? captured
      : Object.freeze({ ...captured, description: text(description, 'Description') });
  validateFrame(frame);
  const target = spec.object;
  if (target && [null, Object.prototype].includes(Object.getPrototypeOf(target))) {
    options(target, ['id'], 'object morph target');
  }
  const id = typeof target === 'string' ? target : target?.id;
  text(id, 'Selected object ID', 300);
  const keys = safeCopy(spec.keys ?? {});
  assert(
    keys && typeof keys === 'object' && !Array.isArray(keys),
    'MORPH_OBJECT_INVALID',
    'Supply a mapping from scene IDs to match keys.',
  );
  assert(Object.keys(keys).length <= MAX_PARTS, 'RESOURCE_LIMIT', 'Too many match keys.');
  for (const key of Object.values(keys)) text(key, 'Morph match key', 200);
  const parts = [];
  let found = false;
  let selectedLeaves = 0;
  let commandCount = 0;
  const bounds = new WeakMap();

  function visit(node, world, selected, blocked) {
    const p = node.props;
    const matrix = multiplyMatrices(world, localMatrix(p, node, bounds));
    const here = selected || node.id === id;
    found ||= node.id === id;
    const effect =
      blocked ||
      node.layerCache != null ||
      p.clip != null ||
      p.mask != null ||
      p.blur !== 0 ||
      p.glow != null ||
      p.texture != null ||
      p.shade != null ||
      p.blend !== 'normal' ||
      p.z !== 0 ||
      p.rotationX !== 0 ||
      p.rotationY !== 0 ||
      p.scaleZ !== 1 ||
      p.depth !== 0;
    if (here && !node.children.length && !['group', 'camera', 'screen'].includes(node.type)) {
      assert(++selectedLeaves <= MAX_PARTS, 'RESOURCE_LIMIT', 'Select at most 128 drawable parts per morph endpoint.');
      const outline =
        !effect &&
        p.opacity > 0 &&
        typeof p.fill === 'string' &&
        p.fill !== 'none' &&
        (p.stroke === 'none' || p.strokeWidth === 0) &&
        (p.trimStart ?? 0) === 0 &&
        (p.trimEnd ?? 1) === 1
          ? localOutline(node)
          : null;
      if (outline?.length) {
        commandCount += outline.length;
        assert(
          commandCount <= MAX_MATCH_COMMANDS,
          'RESOURCE_LIMIT',
          'Selected outline geometry exceeds its command budget.',
        );
        const data = pathData(outline, matrix);
        if (data?.contours.length)
          parts.push({
            ...data,
            id: node.id,
            key: Object.hasOwn(keys, node.id) ? keys[node.id] : null,
            fill: p.fill,
            opacity: p.opacity * p.fillOpacity,
            fillRule: p.fillRule,
          });
      }
    }
    for (const child of node.children) visit(child, matrix, here, effect || p.opacity !== 1);
  }

  for (const node of frame.children) visit(node, UNIT, false, false);
  assert(found, 'UNKNOWN_SHAPE', 'The selected object is absent from its display frame.');
  return { frame, parts, selectedLeaves };
}

function compatible(a, b) {
  return a.contours.length === b.contours.length && a.fillRule === b.fillRule;
}

function backdrop(frame, excluded, name) {
  let index = 0;
  const bounds = new WeakMap();
  const copy = (nodes) =>
    Object.freeze(
      nodes
        .filter((node) => !excluded.has(node.id))
        .map((node) =>
          Object.freeze({
            ...node,
            id: `object:${name}:${++index}`,
            props:
              node.type === 'group' && typeof node.props.pivot === 'string' && node.props.pivot !== 'origin'
                ? Object.freeze({ ...node.props, pivot: Object.freeze(resolvePivot(node, bounds)) })
                : node.props,
            children: copy(node.children),
          }),
        ),
    );
  return Object.freeze({ id: `object:${name}`, type: 'group', children: copy(frame.children) });
}

function preparedPair(source, target, samples, semantic) {
  const outline = semantic && sameMathOutline(source, target);
  const shape = outline ? { sample: outline } : createCompoundMorph(source.contours, target.contours, { samples });
  const fill = colorInterpolator(source.fill, target.fill);
  return { source, target, shape, fill };
}

/** Morph compatible visible outlines across captured 2D objects and fade the remaining original artwork. */
export function createObjectMorph(from, to, spec = {}) {
  return prepareObjectMorph(from, to, spec);
}

function pathNode(id, part, commands, transform = {}) {
  return Object.freeze({
    id,
    type: 'path',
    children: Object.freeze([]),
    props: properties('path', {
      commands,
      fill: part.fill,
      opacity: part.opacity,
      fillRule: part.fillRule,
      stroke: 'none',
      ...transform,
    }),
  });
}

function movingParts(parts, paired, opposite, prefix) {
  return parts
    .filter((part) => !paired.has(part.id))
    .map((part, i) => ({
      part,
      commands: part.contours.flatMap(({ commands }) => commands),
      anchor: equationPartAnchor(part, opposite),
      id: `object:${prefix}:${i}`,
    }));
}

function appendScaled(children, parts, scale) {
  if (scale <= 0) return;
  for (const { id, part, commands, anchor } of parts) {
    children.push(
      pathNode(id, part, commands, {
        x: anchor[0] * (1 - scale),
        y: anchor[1] * (1 - scale),
        scaleX: scale,
        scaleY: scale,
      }),
    );
  }
}

// Shared by the object API and the equation adapter.
export function prepareObjectMorph(from, to, spec, math) {
  options(spec, math ? ['pairs', 'samples'] : ['match', 'pairs', 'samples'], 'object morph');
  const a = endpoint(from);
  const b = endpoint(to);
  if (math) {
    a.parts = describeMathParts(a.parts, math.from);
    b.parts = describeMathParts(b.parts, math.to);
  }
  const match = spec.match ?? 'auto';
  assert(['auto', 'keys', 'geometry'].includes(match), 'MORPH_OBJECT_INVALID', 'Use auto, keys or geometry matching.');
  const samples = number(spec.samples ?? 48, 'object morph contour samples', 8, 128);
  assert(Number.isInteger(samples), 'MORPH_OBJECT_INVALID', 'Contour samples must be a whole number.');
  const { width, height } = a.frame;
  assert(
    width === b.frame.width && height === b.frame.height,
    'VIEWPORT_MISMATCH',
    'Use the same viewport for both morph endpoints.',
  );
  assert(
    !a.frame.motionBlur && !b.frame.motionBlur,
    'MORPH_OBJECT_INVALID',
    'Capture endpoints without motion blur exposures.',
  );
  assert(
    JSON.stringify(a.frame.light) === JSON.stringify(b.frame.light),
    'MORPH_OBJECT_INVALID',
    'Object morph endpoints need the same scene light.',
  );
  const pairs = safeCopy(spec.pairs ?? []);
  assert(
    Array.isArray(pairs) && pairs.length <= MAX_PARTS,
    'MORPH_OBJECT_INVALID',
    'Use bounded [sourceId, targetId] pairs.',
  );
  const left = new Set();
  const right = new Set();
  const tracks = [];
  let estimatedCommands = 0;
  function add(x, y, explicit) {
    assert(
      x &&
        y &&
        compatible(x, y) &&
        (!math || (x.signature && y.signature && x.topology === y.topology)) &&
        !left.has(x.id) &&
        !right.has(y.id),
      'MORPH_TOPOLOGY',
      'Each explicit pair needs distinct, compatible filled outlines.',
    );
    estimatedCommands += x.contours.length * (samples + 1);
    assert(
      estimatedCommands <= MAX_MATCH_COMMANDS,
      'RESOURCE_LIMIT',
      'Object morph exceeds the aggregate path sampling budget.',
    );
    try {
      tracks.push(preparedPair(x, y, samples, math));
      left.add(x.id);
      right.add(y.id);
    } catch (error) {
      if (explicit || !['DEGENERATE_PATH', 'MORPH_TOPOLOGY'].includes(error.code)) throw error;
    }
  }
  for (const pair of pairs) {
    assert(Array.isArray(pair) && pair.length === 2, 'MORPH_OBJECT_INVALID', 'Use [sourceId, targetId] pairs.');
    add(
      a.parts.find((p) => p.id === pair[0]),
      b.parts.find((p) => p.id === pair[1]),
      true,
    );
  }
  const keyed = match === 'keys' || (match === 'auto' && a.parts.some((p) => p.key) && b.parts.some((p) => p.key));
  const diagonal = Math.hypot(width, height);
  const auto = assignParts(
    a.parts.filter((p) => !left.has(p.id)),
    b.parts.filter((p) => !right.has(p.id)),
    (x, y) => {
      if (math) return equationPartCost(x, y);
      if (!compatible(x, y) || (keyed && (!x.key || x.key !== y.key))) return Infinity;
      const positional = Math.hypot(x.center[0] - y.center[0], x.center[1] - y.center[1]) / diagonal;
      const aspect = Math.abs(Math.log(x.width / x.height) - Math.log(y.width / y.height));
      return positional + Math.min(2, aspect * 0.22) + (x.key && x.key === y.key ? 0 : 0.18);
    },
    math ? 5 : undefined,
  );
  for (const [x, y] of auto) add(x, y, false);
  const leaving = math ? movingParts(a.parts, left, b.parts, 'leaving') : [];
  const entering = math ? movingParts(b.parts, right, a.parts, 'entering') : [];
  for (const { part } of leaving) left.add(part.id);
  for (const { part } of entering) right.add(part.id);
  const fromBackdrop = backdrop(a.frame, left, 'from');
  const toBackdrop = backdrop(b.frame, right, 'to');

  function sample(progress) {
    number(progress, 'object morph progress', 0, 1);
    if (progress === 0) return a.frame;
    if (progress === 1) return b.frame;
    const children = [
      Object.freeze({ ...fromBackdrop, props: properties('group', { opacity: 1 - progress }) }),
      Object.freeze({ ...toBackdrop, props: properties('group', { opacity: progress }) }),
    ];
    tracks.forEach(({ source, target, shape, fill }, i) =>
      children.push(
        pathNode(
          `object:part:${i}`,
          {
            fill: fill(progress),
            opacity: source.opacity + (target.opacity - source.opacity) * progress,
            fillRule: source.fillRule,
          },
          shape.sample(progress),
        ),
      ),
    );
    appendScaled(children, leaving, 1 - progress / 0.55);
    appendScaled(children, entering, (progress - 0.45) / 0.55);
    return Object.freeze({
      width,
      height,
      ...(a.frame.description === undefined ? {} : { description: a.frame.description }),
      ...(a.frame.light ? { light: a.frame.light } : {}),
      children: Object.freeze(children),
    });
  }
  validateFrame(sample(0.5));
  return Object.freeze({
    sample,
    diagnostics: Object.freeze({
      matched: Object.freeze(tracks.map(({ source, target }) => Object.freeze({ from: source.id, to: target.id }))),
      fadedOut: a.selectedLeaves - left.size,
      fadedIn: b.selectedLeaves - right.size,
      ...(math
        ? {
            strategy: 'semantic',
            reshaped: tracks.filter(({ source, target }) => source.glyph !== target.glyph).length,
            leaving: leaving.length,
            entering: entering.length,
          }
        : { strategy: keyed ? 'keys' : 'geometry' }),
    }),
  });
}
