import { sceneLight } from '../graphics/lighting.js';
import { localMatrix } from '../core/transform.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
import { captureState } from '../core/transition.js';
import { validateProperty } from '../core/geometry.js';
import { createMorph } from './contour.js';
import { ellipsePath, roundedRectPath, transformPath } from '../geometry/index.js';
import { multiplyMatrices, transformPoint } from '../camera/math.js';
import { validateFrame } from '../renderers/shared.js';

const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

function outline(node) {
  const p = node.props;
  if (node.type === 'path') return p.commands;
  if (node.type === 'circle') return ellipsePath({ rx: p.r, ry: p.r });
  if (node.type === 'rect') return roundedRectPath({ width: p.width, height: p.height, radius: p.rx });
  assert(false, 'UNSUPPORTED_MATCH', 'Match a path, circle or rectangle outline.');
}
function endpoint(spec, label, captured = null) {
  options(spec, ['frame', 'shape', 'matrix'], label);
  const frame = captured ?? captureState(spec.frame),
    id = typeof spec.shape === 'string' ? spec.shape : spec.shape?.id;
  validateFrame(frame);
  assert(typeof id === 'string' && id.length, 'INVALID_MATCH', 'Select a shape ID in a captured/displayed frame.');
  let found = null;
  function visit(node, parent, clipped, alpha = 1, effected = false) {
    const p = node.props,
      world = multiplyMatrices(parent, localMatrix(p, node)),
      hasClip = clipped || p.clip !== null,
      opacity = alpha * p.opacity,
      hasEffect =
        effected ||
        p.blur !== 0 ||
        p.glow !== null ||
        p.mask !== null ||
        p.blend !== 'normal' ||
        !!p.shade ||
        !!p.texture;
    assert(
      (p.z ?? 0) === 0 && (p.rotationX ?? 0) === 0 && (p.rotationY ?? 0) === 0 && (p.depth ?? 0) === 0,
      'UNSUPPORTED_MATCH',
      'Match cuts require an explicitly projected 2D frame.',
    );
    if (node.id === id) {
      assert(!hasClip, 'UNSUPPORTED_MATCH', 'Clipped selections need an explicit unclipped correspondence outline.');
      assert(
        !hasEffect,
        'UNSUPPORTED_MATCH',
        'Selections with effects or effected ancestors need explicitly prepared screen-space artwork.',
      );
      assert(
        !(p.strokeDasharray ?? []).some((v) => v > 0),
        'UNSUPPORTED_MATCH',
        'Dashed selections need explicitly prepared filled outlines.',
      );
      assert(
        (p.trimStart ?? 0) === 0 && (p.trimEnd ?? 1) === 1,
        'UNSUPPORTED_MATCH',
        'Trimmed strokes need an explicit visible correspondence outline.',
      );
      found = { node, world, opacity };
    }
    for (const child of node.children) visit(child, world, hasClip, opacity, hasEffect);
  }
  for (const node of frame.children) visit(node, IDENTITY, false);
  assert(found, 'UNKNOWN_SHAPE', 'The selected match shape is absent.');
  const extra = spec.matrix ?? IDENTITY,
    matrix = multiplyMatrices(extra, found.world),
    commands = outline(found.node).map((c) => {
      const out = [c[0]];
      for (let i = 1; i < c.length; i += 2) {
        const p = transformPoint(matrix, { x: c[i], y: c[i + 1] });
        out.push(p.x, p.y);
      }
      return out;
    });
  const p = found.node.props,
    sx = Math.hypot(matrix[0], matrix[1]),
    sy = Math.hypot(matrix[2], matrix[3]),
    dot = matrix[0] * matrix[2] + matrix[1] * matrix[3],
    activeStroke = p.stroke !== 'none' && p.strokeWidth > 0;
  if (activeStroke)
    assert(
      sx > 0 && Math.abs(sx - sy) <= 1e-9 * Math.max(sx, sy) && Math.abs(dot) <= 1e-9 * sx * sy,
      'UNSUPPORTED_MATCH',
      'Stroked selections require a nonsingular uniform screen transform; prepare nonuniform strokes as filled outlines.',
    );
  return {
    frame,
    node: found.node,
    commands,
    opacity: found.opacity,
    strokeWidth: activeStroke ? p.strokeWidth * sx : 0,
  };
}
/** Align selected on-screen contours while the other two scenes crossfade. */
function singleMatchCut(spec = {}, captured = null) {
  options(
    spec,
    [
      'from',
      'to',
      'anchor',
      'scale',
      'samples',
      'tolerance',
      'align',
      'reverse',
      'fill',
      'background',
      'alignAt',
      'releaseAt',
    ],
    'match cut',
  );
  const from = endpoint(spec.from, 'match from', captured?.from),
    to = endpoint(spec.to, 'match to', captured?.to),
    width = from.frame.width,
    height = from.frame.height;
  assert(
    width === to.frame.width && height === to.frame.height,
    'VIEWPORT_MISMATCH',
    'Both displayed match frames need the same viewport.',
  );
  const anchor = spec.anchor ?? { x: width / 2, y: height / 2 };
  options(anchor, ['x', 'y'], 'match anchor');
  number(anchor.x, 'anchor x');
  number(anchor.y, 'anchor y');
  const scale = number(spec.scale ?? 1, 'match scale', 1e-6, 1e4);
  // Bounds include control points, so normalization is deterministic and conservative.
  function align(commands) {
    const pairs = commands.flatMap((c) =>
      Array.from({ length: (c.length - 1) / 2 }, (_, i) => ({ x: c[i * 2 + 1], y: c[i * 2 + 2] })),
    );
    assert(pairs.length, 'DEGENERATE_PATH', 'Match outline needs geometry.');
    const x0 = Math.min(...pairs.map((p) => p.x)),
      x1 = Math.max(...pairs.map((p) => p.x)),
      y0 = Math.min(...pairs.map((p) => p.y)),
      y1 = Math.max(...pairs.map((p) => p.y));
    return transformPath(commands, {
      x: anchor.x - ((x0 + x1) / 2) * scale,
      y: anchor.y - ((y0 + y1) / 2) * scale,
      scaleX: scale,
      scaleY: scale,
    });
  }
  const alignAt = number(spec.alignAt ?? 0.2, 'alignment phase end', 0.001, 0.998),
    releaseAt = number(spec.releaseAt ?? 0.8, 'release phase start', 0.002, 0.999);
  assert(releaseAt > alignAt, 'INVALID_MATCH', 'Release must follow the alignment phase.');
  assert(
    typeof from.node.props.stroke === 'string' &&
      typeof to.node.props.stroke === 'string' &&
      (spec.fill !== undefined || (typeof from.node.props.fill === 'string' && typeof to.node.props.fill === 'string')),
    'UNSUPPORTED_MATCH',
    'Use solid selected paints or an explicit solid fill; local gradients need a separate paint transform.',
  );
  if (spec.fill !== undefined) {
    assert(typeof spec.fill === 'string', 'UNSUPPORTED_MATCH', 'Use an explicit solid match fill.');
    validateProperty('path', 'fill', spec.fill);
  }
  const morphOptions = Object.fromEntries(
      ['samples', 'tolerance', 'align', 'reverse'].filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]),
    ),
    alignedFrom = align(from.commands),
    alignedTo = align(to.commands),
    morph = createMorph(alignedFrom, alignedTo, morphOptions);
  function background(frame, id) {
    function copy(nodes) {
      return nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: copy(n.children) }));
    }
    return copy(frame.children);
  }
  const fade = spec.background ?? 'crossfade',
    backA = fade === 'hide' ? [] : background(from.frame, from.node.id),
    backB = fade === 'hide' ? [] : background(to.frame, to.node.id);
  assert(['crossfade', 'hide'].includes(fade), 'INVALID_MATCH', 'background must crossfade or hide.');
  const count = (nodes) => nodes.reduce((n, node) => n + 1 + count(node.children), 0);
  assert(
    count(backA) + count(backB) + 3 <= 10000,
    'RESOURCE_LIMIT',
    'Combined match-cut frame exceeds the node budget.',
  );
  const depth = (nodes) => nodes.reduce((d, node) => Math.max(d, 1 + depth(node.children)), 0);
  assert(
    fade !== 'crossfade' || Math.max(depth(backA), depth(backB)) + 1 <= 64,
    'RESOURCE_LIMIT',
    'Match-cut background wrappers exceed the hierarchy depth budget.',
  );
  for (const boundary of [from, to]) validateProperty('path', 'strokeWidth', boundary.strokeWidth * Math.max(1, scale));
  const commandCount = (nodes) =>
    nodes.reduce(
      (n, node) =>
        n + (node.props.commands?.length ?? 0) + (node.props.clip?.commands?.length ?? 0) + commandCount(node.children),
      0,
    );
  assert(
    commandCount(backA) +
      commandCount(backB) +
      Math.max(from.commands.length, to.commands.length, (spec.samples ?? 128) + 1) <=
      100000,
    'RESOURCE_LIMIT',
    'Combined match-cut paths exceed the command budget.',
  );
  function prefix(nodes, key) {
    let index = 0;
    const copy = (node) =>
      Object.freeze({ ...node, id: `match:${key}:${++index}`, children: Object.freeze(node.children.map(copy)) });
    return Object.freeze(nodes.map(copy));
  }
  const fromBackground = prefix(backA, 'from'),
    toBackground = prefix(backB, 'to');
  const interpolate = (a, b, t) =>
    Object.freeze(a.map((c, i) => Object.freeze([c[0], ...c.slice(1).map((v, j) => v + (b[i][j + 1] - v) * t)])));
  const light = compatibleLight(from.frame, to.frame, fade === 'crossfade');
  const cut = Object.freeze({
    diagnostics: Object.freeze({
      method: 'screenContourMatch',
      anchor: Object.freeze({ ...anchor }),
      scale,
      normalization: 'controlBoundsCenter',
      alignAt,
      releaseAt,
      exactSceneEndpoints: true,
    }),
    sample(progress) {
      number(progress, 'match progress', 0, 1);
      if (progress === 0) return from.frame;
      if (progress === 1) return to.frame;
      const phase = Math.max(0, Math.min(1, (progress - alignAt) / (releaseAt - alignAt))),
        children = [];
      if (fade === 'crossfade')
        children.push(
          Object.freeze({
            id: 'match:background-from',
            type: 'group',
            props: Object.freeze({ opacity: 1 - phase }),
            children: fromBackground,
          }),
          Object.freeze({
            id: 'match:background-to',
            type: 'group',
            props: Object.freeze({ opacity: phase }),
            children: toBackground,
          }),
        );
      const commands =
        progress < alignAt
          ? interpolate(from.commands, alignedFrom, progress / alignAt)
          : progress > releaseAt
            ? interpolate(alignedTo, to.commands, (progress - releaseAt) / (1 - releaseAt))
            : morph.sample(phase);
      const boundary = phase < 0.5 ? from : to,
        selected = boundary.node,
        strokeScale =
          progress < alignAt
            ? 1 + ((scale - 1) * progress) / alignAt
            : progress > releaseAt
              ? scale + ((1 - scale) * (progress - releaseAt)) / (1 - releaseAt)
              : scale;
      children.push(
        Object.freeze({
          id: 'match:contour',
          type: 'path',
          props: Object.freeze({
            commands,
            fill: spec.fill ?? selected.props.fill,
            fillRule: selected.props.fillRule,
            stroke: selected.props.stroke,
            strokeWidth: boundary.strokeWidth * strokeScale,
            strokeLinecap: selected.props.strokeLinecap,
            strokeLinejoin: selected.props.strokeLinejoin,
            strokeMiterlimit: selected.props.strokeMiterlimit,
            fillOpacity:
              (from.node.props.fillOpacity ?? 1) +
              ((to.node.props.fillOpacity ?? 1) - (from.node.props.fillOpacity ?? 1)) * phase,
            strokeOpacity:
              (from.node.props.strokeOpacity ?? 1) +
              ((to.node.props.strokeOpacity ?? 1) - (from.node.props.strokeOpacity ?? 1)) * phase,
            opacity: from.opacity + (to.opacity - from.opacity) * phase,
          }),
          children: Object.freeze([]),
        }),
      );
      return Object.freeze({ width, height, ...(light ? { light } : {}), children: Object.freeze(children) });
    },
  });
  // Both background trees coexist throughout the bridge, even at zero opacity.
  // Reuse the renderer boundary for all aggregate budgets (including paint and
  // mask stops), rather than maintaining a partial parallel budget definition.
  validateFrame(cut.sample((alignAt + releaseAt) / 2));
  return cut;
}

/** One or several explicit contour correspondences, sharing the established three phases.
 * @param {{from:{frame:any,shape?:string|{id:string},matrix?:number[]},to:{frame:any,shape?:string|{id:string},matrix?:number[]},pairs?:Array<[string,string]>,anchor?:{x:number,y:number},scale?:number,samples?:number,tolerance?:number,align?:'auto'|'none',reverse?:boolean|'auto',fill?:string,background?:'crossfade'|'hide',alignAt?:number,releaseAt?:number}} [spec]
 */
export function matchCut(spec = {}) {
  options(
    spec,
    [
      'from',
      'to',
      'pairs',
      'anchor',
      'scale',
      'samples',
      'tolerance',
      'align',
      'reverse',
      'fill',
      'background',
      'alignAt',
      'releaseAt',
    ],
    'match cut',
  );
  if (spec.pairs === undefined) {
    const cut = singleMatchCut(spec);
    for (const p of [cut.diagnostics.alignAt, cut.diagnostics.releaseAt]) validateFrame(cut.sample(p));
    return cut;
  }
  options(spec.from, ['frame', 'matrix'], 'multi match from');
  options(spec.to, ['frame', 'matrix'], 'multi match to');
  const pairs = safeCopy(spec.pairs);
  assert(
    Array.isArray(pairs) && pairs.length > 0 && pairs.length <= 64,
    'RESOURCE_LIMIT',
    'Match 1–64 explicit shape pairs.',
  );
  const left = new Set(),
    right = new Set();
  for (const pair of pairs) {
    assert(
      Array.isArray(pair) &&
        pair.length === 2 &&
        pair.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 1024),
      'INVALID_MATCH',
      'Each pair contains a source ID and a target ID.',
    );
    assert(
      !left.has(pair[0]) && !right.has(pair[1]),
      'INVALID_MATCH',
      'Match each selected shape only once on each side.',
    );
    left.add(pair[0]);
    right.add(pair[1]);
  }
  const samples = number(spec.samples ?? 128, 'match samples', 2, 512);
  assert(
    Number.isInteger(samples) && pairs.length * samples * samples <= 8000000,
    'RESOURCE_LIMIT',
    'Combined match preparation exceeds its sample budget.',
  );
  const from = captureState(spec.from.frame),
    to = captureState(spec.to.frame);
  validateFrame(from);
  validateFrame(to);
  assert(
    from.width === to.width && from.height === to.height,
    'VIEWPORT_MISMATCH',
    'Both displayed match frames need the same viewport.',
  );
  const common = Object.fromEntries(
    Object.entries(spec).filter(([key]) => !['from', 'to', 'pairs', 'background'].includes(key)),
  );
  const cuts = pairs.map((pair) =>
    singleMatchCut(
      { ...common, from: { ...spec.from, shape: pair[0] }, to: { ...spec.to, shape: pair[1] }, background: 'hide' },
      { from, to },
    ),
  );
  const fade = spec.background ?? 'crossfade';
  assert(['crossfade', 'hide'].includes(fade), 'INVALID_MATCH', 'background must crossfade or hide.');
  const prefix = (nodes, removed, side) =>
    nodes
      .filter((node) => !removed.has(node.id))
      .map((node) =>
        Object.freeze({
          ...node,
          id: `match:multi:${side}:${node.id}`,
          children: Object.freeze(prefix(node.children, removed, side)),
        }),
      );
  const light = compatibleLight(from, to, fade === 'crossfade');
  const backgrounds = [
      Object.freeze(prefix(from.children, left, 'from')),
      Object.freeze(prefix(to.children, right, 'to')),
    ],
    alignAt = cuts[0].diagnostics.alignAt,
    releaseAt = cuts[0].diagnostics.releaseAt;
  const sample = (progress) => {
    number(progress, 'match progress', 0, 1);
    if (progress === 0) return from;
    if (progress === 1) return to;
    const phase = Math.max(0, Math.min(1, (progress - alignAt) / (releaseAt - alignAt))),
      children = [];
    if (fade === 'crossfade')
      for (let i = 0; i < 2; i++)
        children.push(
          Object.freeze({
            id: `match:multi:background:${i}`,
            type: 'group',
            props: Object.freeze({ opacity: i ? phase : 1 - phase }),
            children: backgrounds[i],
          }),
        );
    cuts.forEach((cut, i) => {
      const node = cut.sample(progress).children.at(-1);
      children.push(Object.freeze({ ...node, id: `match:multi:pair:${i}` }));
    });
    return Object.freeze({
      width: from.width,
      height: from.height,
      ...(light ? { light } : {}),
      children: Object.freeze(children),
    });
  };
  for (const progress of [alignAt, (alignAt + releaseAt) / 2, releaseAt]) validateFrame(sample(progress));
  return Object.freeze({
    diagnostics: Object.freeze({
      method: 'multiScreenContourMatch',
      pairs,
      alignAt,
      releaseAt,
      exactSceneEndpoints: true,
    }),
    sample,
  });
}

function compatibleLight(from, to, backgrounds) {
  const shaded = (nodes) => nodes.some((node) => node.props.shade || shaded(node.children));
  if (backgrounds && (shaded(from.children) || shaded(to.children)))
    assert(
      JSON.stringify(sceneLight(from.light)) === JSON.stringify(sceneLight(to.light)),
      'UNSUPPORTED_MATCH',
      'Backgrounds with different global lighting need prepared unlit frames.',
    );
  return from.light ?? to.light;
}
