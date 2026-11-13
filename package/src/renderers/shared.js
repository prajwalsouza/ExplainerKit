import { validateProperty } from '../core/geometry.js';
import { localMatrix, pivotKeywords } from '../core/transform.js';
/** Renderer boundary: frames are data, never markup or executable code. */
import {
  validateClip,
  validatePaint,
  pathCommands,
  strokeDasharray,
  fillRule as validateFillRule,
} from '../graphics/index.js';
import { sceneLight, validateShade } from '../graphics/lighting.js';
import { validateTexture } from '../graphics/texture.js';
import { strokeTrim } from '../graphics/trim.js';
import { validateBlur, validateGlow, validateMask, blendMode } from '../graphics/look.js';
import { inspectCloud, POINT_SHAPES } from '../graphics/cloud.js';
export const MAX_NODES = 10000;
export const MAX_DEPTH = 64;
export const MAX_RASTER_PIXELS = 8_294_400;
export const MAX_SCRATCH_PIXELS = 16_000_000;
export const MAX_FRAME_POINTS = 1_000_000;
const TYPES = new Set(['group', 'circle', 'rect', 'line', 'path', 'text', 'cloud']);
const ARITY = Object.freeze({ M: 2, L: 2, C: 6, Q: 4, Z: 0 });
const closedPath = (commands) => {
  if (!Array.isArray(commands) || !commands.length) return false;
  let open = false;
  for (const c of commands) {
    if (!Array.isArray(c)) return false;
    if (c[0] === 'M') {
      if (open) return false;
      open = true;
    } else if (c[0] === 'Z') open = false;
    else open = true;
  }
  return !open;
};
const NUMERIC = [
  'x',
  'y',
  'z',
  'rotation',
  'skewX',
  'skewY',
  'rotationX',
  'rotationY',
  'scaleZ',
  'depth',
  'scaleX',
  'scaleY',
  'opacity',
  'fillOpacity',
  'strokeOpacity',
  'minScreenSize',
  'lineHeight',
  'r',
  'width',
  'height',
  'rx',
  'x1',
  'y1',
  'x2',
  'y2',
  'strokeWidth',
  'strokeDashoffset',
  'strokeMiterlimit',
  'trimStart',
  'trimEnd',
  'trimOffset',
  'pointSize',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'textAdvance',
];

export function rendererError(message, code = 'RENDER_INVALID') {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function assertContainer(container) {
  if (!container?.ownerDocument || typeof container.appendChild !== 'function') {
    throw rendererError('A DOM container is required.');
  }
}

function inspectFrame(frame, prepared = null) {
  if (!frame || !Array.isArray(frame.children)) throw rendererError('A frame needs children.');
  if (frame.description !== undefined && (typeof frame.description !== 'string' || frame.description.length > 10000))
    throw rendererError('Frame description must be text of at most 10000 characters.');
  for (const key of ['width', 'height']) {
    if (!Number.isFinite(frame[key]) || frame[key] <= 0 || frame[key] > 16384) {
      throw rendererError(`Frame ${key} must be finite, positive and at most 16384.`);
    }
  }
  if (frame.light !== undefined)
    try {
      sceneLight(frame.light);
    } catch (error) {
      throw rendererError(error.message);
    }
  const seen = new Set();
  let commands = 0,
    stops = 0,
    points = 0;
  function visit(node, depth) {
    if (depth > MAX_DEPTH || seen.size >= MAX_NODES) throw rendererError('Frame complexity limit exceeded.');
    if (!node || typeof node.id !== 'string' || !node.id || node.id.length > 1024 || seen.has(node.id))
      throw rendererError('Node IDs must be unique nonempty strings.');
    seen.add(node.id);
    if (!TYPES.has(node.type)) throw rendererError(`Unsupported node type: ${node.type}`);
    const p = node.props;
    if (!p || typeof p !== 'object') throw rendererError('Node properties are required.');
    const normalized = {};
    if (
      p.shade &&
      !(
        node.type === 'group' ||
        node.type === 'circle' ||
        node.type === 'rect' ||
        (node.type === 'path' && closedPath(p.commands))
      )
    )
      throw rendererError('Shade requires a closed shape or group.');
    if (node.layerCache) {
      const b = node.layerCache.bounds;
      if (
        node.type !== 'group' ||
        !b ||
        !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(b[k])) ||
        b.width <= 0 ||
        b.height <= 0
      )
        throw rendererError('Invalid layer cache bounds.');
    }
    for (const key of NUMERIC) {
      if (
        p[key] !== undefined &&
        !(key === 'textAdvance' && p[key] === null) &&
        (!Number.isFinite(p[key]) || Math.abs(p[key]) > 1e7)
      )
        throw rendererError(`Invalid numeric ${key}.`);
    }
    for (const key of ['r', 'width', 'height', 'rx', 'strokeWidth', 'fontSize']) {
      if (p[key] !== undefined && p[key] < 0) throw rendererError(`${key} cannot be negative.`);
    }
    if (p.opacity !== undefined && (p.opacity < 0 || p.opacity > 1)) throw rendererError('Opacity must be in [0,1].');
    for (const key of ['fillOpacity', 'strokeOpacity'])
      if (p[key] !== undefined && (p[key] < 0 || p[key] > 1)) throw rendererError(`${key} must be in [0,1].`);
    if (p.halo != null)
      try {
        normalized.halo = validateProperty('text', 'halo', p.halo);
        if (node.type !== 'text' || (p.stroke && p.stroke !== 'none'))
          throw rendererError('Text halo requires text without a separate authored stroke.');
      } catch (error) {
        throw rendererError(error.message);
      }
    if (p.strokeDasharray !== undefined)
      try {
        normalized.strokeDasharray = strokeDasharray(p.strokeDasharray);
      } catch (error) {
        throw rendererError(error.message);
      }
    if (
      p.pivot !== undefined &&
      p.pivot !== null &&
      !(Array.isArray(p.pivot) && p.pivot.length === 2 && p.pivot.every(Number.isFinite)) &&
      !pivotKeywords.includes(p.pivot)
    )
      throw rendererError('Invalid pivot.');
    if (Math.abs(p.skewX ?? 0) > 1.4 || Math.abs(p.skewY ?? 0) > 1.4) throw rendererError('Skew exceeds 1.4 radians.');
    if (p.blur !== undefined)
      try {
        normalized.blur = validateBlur(p.blur);
      } catch (error) {
        throw rendererError(error.message);
      }
    try {
      if (p.shade !== undefined) normalized.shade = validateShade(p.shade);
      if (p.texture !== undefined) normalized.texture = validateTexture(p.texture);
      if (p.glow !== undefined) normalized.glow = validateGlow(p.glow);
      if (p.mask !== undefined) normalized.mask = validateMask(p.mask);
      if (p.blend !== undefined) normalized.blend = blendMode(p.blend);
    } catch (error) {
      throw rendererError(error.message);
    }
    stops += p.mask?.gradient?.stops?.length ?? 0;
    if (p.depth !== undefined && p.depth < 0) throw rendererError('Depth must be nonnegative.');
    if (p.strokeLinecap !== undefined && !['butt', 'round', 'square'].includes(p.strokeLinecap))
      throw rendererError('Unsupported stroke cap.');
    if (p.strokeLinejoin !== undefined && !['miter', 'round', 'bevel'].includes(p.strokeLinejoin))
      throw rendererError('Unsupported stroke join.');
    if (p.strokeMiterlimit !== undefined && (p.strokeMiterlimit < 1 || p.strokeMiterlimit > 1e4))
      throw rendererError('Invalid miter limit.');
    for (const k of ['trimStart', 'trimEnd'])
      if (p[k] !== undefined && (p[k] < 0 || p[k] > 1)) throw rendererError('Trim fractions must be in [0,1].');
    if (p.trimOffset !== undefined && Math.abs(p.trimOffset) > 1e4)
      throw rendererError('Trim offset exceeds the cycle limit.');
    for (const key of ['fill', 'stroke']) {
      if (p[key] !== undefined)
        try {
          normalized[key] = p[key]?.type === 'texture' ? validateTexture(p[key]) : validatePaint(p[key]);
          stops += p[key]?.stops?.length ?? 0;
        } catch (error) {
          throw rendererError(error.message);
        }
    }
    if (stops > 100000) throw rendererError('Gradient stop budget exceeded.');
    if (p.fillRule !== undefined)
      try {
        normalized.fillRule = validateFillRule(p.fillRule);
      } catch (error) {
        throw rendererError(error.message);
      }
    if (p.clip !== undefined && p.clip !== null)
      try {
        normalized.clip = validateClip(p.clip);
        commands += p.clip.commands?.length ?? 0;
      } catch (error) {
        throw rendererError(error.message);
      }
    if (commands > 100000) throw rendererError('Path and clip command budget exceeded.');
    if (node.type === 'path') {
      if (!Array.isArray(p.commands)) throw rendererError('A path needs commands.');
      commands += p.commands.length;
      if (commands > 100000) throw rendererError('Path command budget exceeded.');
      for (const c of p.commands) {
        if (
          !Array.isArray(c) ||
          !Object.hasOwn(ARITY, c[0]) ||
          c.length !== ARITY[c[0]] + 1 ||
          c.slice(1).some((v) => !Number.isFinite(v) || Math.abs(v) > 1e7)
        )
          throw rendererError('Invalid path command.');
      }
    }
    if (node.type === 'cloud') {
      try {
        normalized.points = inspectCloud(p.points);
      } catch (error) {
        throw rendererError(error.message);
      }
      points += normalized.points.count;
      if (points > MAX_FRAME_POINTS) throw rendererError('Frame point-cloud budget exceeded.');
      if (p.pointShape !== undefined && !POINT_SHAPES.includes(p.pointShape))
        throw rendererError('Unsupported point shape.');
      if (p.pointBlend !== undefined && !['normal', 'add'].includes(p.pointBlend))
        throw rendererError('Unsupported point blend.');
      if (p.pointSize !== undefined && (p.pointSize < 0 || p.pointSize > 1e4))
        throw rendererError('Point size must be between 0 and 10000.');
      if (p.fill !== undefined && typeof p.fill !== 'string')
        throw rendererError('A cloud fill must be a solid color.');
    }
    if (node.type === 'text') {
      if (p.textOutline != null)
        try {
          normalized.textOutline = pathCommands(p.textOutline);
          commands += normalized.textOutline.length;
          if (commands > 100000) throw rendererError('Text outline command budget exceeded.');
        } catch (error) {
          throw rendererError(error.message);
        }
      if (typeof p.text !== 'string' || p.text.length > 10000)
        throw rendererError('Text must be a string of at most 10000 characters.');
      if (p.fontWeight !== undefined && (p.fontWeight < 100 || p.fontWeight > 900))
        throw rendererError('Font weight must be between 100 and 900.');
      if (p.letterSpacing !== undefined && (p.letterSpacing < -100 || p.letterSpacing > 100))
        throw rendererError('Letter spacing must be between -100 and 100.');
      if (
        p.fontFamily !== undefined &&
        (typeof p.fontFamily !== 'string' || p.fontFamily.length > 200 || !/^[\w\s,\-"']+$/.test(p.fontFamily))
      )
        throw rendererError('Unsupported font family.');
      if (p.align !== undefined && !['start', 'middle', 'end'].includes(p.align))
        throw rendererError('Unsupported text alignment.');
      if (p.baseline !== undefined && !['alphabetic', 'middle', 'hanging'].includes(p.baseline))
        throw rendererError('Unsupported text baseline.');
    }
    if (node.children !== undefined && !Array.isArray(node.children)) throw rendererError('Children must be an array.');
    if (node.type !== 'group' && node.children?.length) throw rendererError('Only groups can contain children.');
    if (prepared) prepared.set(node.id, normalized);
    for (const child of node.children ?? []) visit(child, depth + 1);
  }
  for (const child of frame.children) visit(child, 1);
  return seen;
}

export function validateFrame(frame) {
  return inspectFrame(frame);
}

/** Capture descriptor defaults before a backend can mutate its last valid output. */
export function prepareFrame(frame) {
  const prepared = new Map(),
    ids = inspectFrame(frame, prepared);
  const node = (value) => ({
    ...value,
    props: { ...value.props, ...prepared.get(value.id) },
    children: (value.children ?? []).map(node),
  });
  return { ids, frame: { ...frame, children: frame.children.map(node) } };
}

export function pathData(commands) {
  return commands.map((c) => c.join(' ')).join(' ');
}

/** Backend capability negotiation before any DOM or raster mutation. */
export function prepare2D(frame) {
  const trims = new Map();
  function visit(node) {
    const p = node.props;
    if (
      (p.z ?? 0) !== 0 ||
      (p.rotationX ?? 0) !== 0 ||
      (p.rotationY ?? 0) !== 0 ||
      (p.scaleZ ?? 1) !== 1 ||
      (p.depth ?? 0) !== 0
    ) {
      const e = rendererError(
        'This backend is 2D. Use a spatial projection or the optional three.js adapter.',
        'RENDER_UNSUPPORTED',
      );
      e.capability = 'spatial3D';
      throw e;
    }
    if (node.type === 'path') {
      const trim = strokeTrim(p.commands, p.trimStart ?? 0, p.trimEnd ?? 1, p.trimOffset ?? 0);
      if (trim && p.strokeDasharray?.some((v) => v > 0)) {
        const e = rendererError('Authored dashes and path trim cannot share one stroke pattern.', 'RENDER_UNSUPPORTED');
        e.capability = 'stroke.dashTrim';
        throw e;
      }
      trims.set(node.id, trim);
    }
    for (const child of node.children ?? []) visit(child);
  }
  frame.children.forEach(visit);
  return trims;
}

export function transformString(p, node) {
  if (p.pivot || p.skewX || p.skewY) return `matrix(${localMatrix(p, node).join(' ')})`;
  return `translate(${p.x ?? 0} ${p.y ?? 0}) rotate(${((p.rotation ?? 0) * 180) / Math.PI}) scale(${p.scaleX ?? 1} ${p.scaleY ?? 1})`;
}

export function textContent(frame) {
  const texts = [];
  function visit(node, visible) {
    visible = visible && (node.props.opacity ?? 1) > 0;
    if (visible && node.type === 'text') texts.push(node.props.text);
    for (const child of node.children ?? []) visit(child, visible);
  }
  frame.children.forEach((node) => visit(node, true));
  return texts.join('\n');
}
