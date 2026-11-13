import { assert, number, options } from '../core/validate.js';
import { localBounds, localMatrix, multiplyAffine } from '../core/transform.js';
import { fitRegion } from './math.js';
const IDENTITY = [1, 0, 0, 1, 0, 0];
export function captureKeeping(scene, handles, spec = {}) {
  options(spec, ['padding', 'ground', 'at', 'until'], 'camera keeping');
  const list = Array.isArray(handles) ? handles : [handles];
  assert(list.length > 0 && list.length <= 128, 'RESOURCE_LIMIT', 'Keep 1–128 live scene handles.');
  const ids = [];
  for (let i = 0; i < list.length; i++) {
    const d = Object.getOwnPropertyDescriptor(list, i);
    assert(d && 'value' in d, 'INVALID_CAMERA_TARGET', 'Keep targets must be dense handles without accessors.');
    const h = d.value;
    assert(
      h?._scene === scene && !h._record?.detached && scene._pathTo(h._record),
      'INVALID_CAMERA_TARGET',
      'Keep live handles owned by this scene.',
    );
    assert(!ids.includes(h.id), 'INVALID_CAMERA_TARGET', 'Keep target IDs must be unique.');
    ids.push(h.id);
  }
  const at = number(spec.at ?? 0, 'keep at', 0, 86400),
    until = number(spec.until ?? 86400, 'keep until', 0, 86400),
    padding = number(spec.padding ?? 24, 'keep padding', 0, 8192),
    ground = spec.ground ?? 'center';
  assert(
    until > at && ['center', 'bottom'].includes(ground),
    'INVALID_CAMERA_KEEP',
    'Keep needs a positive interval and center or bottom alignment.',
  );
  return Object.freeze({ ids: Object.freeze(ids), at, until, padding, ground });
}
/** Consume the current world frame only; never re-enters sampling or camera projection. */
export function fitKeeping(rule, frame, pose, screenRoots) {
  const wanted = new Set(rule.ids),
    found = new Set(),
    cache = new WeakMap();
  let xmin = Infinity,
    ymin = Infinity,
    xmax = -Infinity,
    ymax = -Infinity,
    count = 0;
  const include = (m, x, y) => {
    const a = m[0] * x + m[2] * y + m[4],
      b = m[1] * x + m[3] * y + m[5];
    number(a, 'keep bound x');
    number(b, 'keep bound y');
    xmin = Math.min(xmin, a);
    ymin = Math.min(ymin, b);
    xmax = Math.max(xmax, a);
    ymax = Math.max(ymax, b);
  };
  function visit(node, parent, selected, forbidden, effects, depth) {
    assert(depth <= 64 && ++count <= 10000, 'RESOURCE_LIMIT', 'Camera keeping exceeds the frame traversal budget.');
    const own = wanted.has(node.id),
      active = selected || own,
      blocked = forbidden || screenRoots.has(node.id) || !!node.layerCache;
    if (own) {
      assert(!blocked, 'INVALID_CAMERA_TARGET', 'Keep targets cannot use screen-space or depth-layer coordinates.');
      found.add(node.id);
    }
    const p = node.props,
      m = multiplyAffine(parent, localMatrix(p, node, cache)),
      hasEffects = effects || !!p.glow || !!p.blur;
    if (active) {
      assert(!blocked, 'INVALID_CAMERA_TARGET', 'Kept branches cannot include screen-space or depth-layer content.');
      assert(
        !hasEffects,
        'CAMERA_KEEP_UNSUPPORTED',
        'Keep requires unfiltered geometry; frame a padded authored region for blur/glow.',
      );
      assert(
        node.type !== 'text' || p.textOutline,
        'CAMERA_KEEP_UNSUPPORTED',
        'Keep native text requires imported outlines for reliable bounds.',
      );
      assert(
        !p.minScreenSize,
        'CAMERA_KEEP_UNSUPPORTED',
        'Keep cannot fit screen-size-dependent text without a fixed outline.',
      );
      if (node.type !== 'group') {
        const b = localBounds({ ...node, children: [] }, cache),
          stroke = p.stroke && p.stroke !== 'none' ? (p.strokeWidth ?? 1) / 2 : 0,
          pad = stroke * ((p.strokeLinejoin ?? 'miter') === 'miter' ? (p.strokeMiterlimit ?? 4) : Math.SQRT2);
        for (const x of [b.x - pad, b.x + b.width + pad])
          for (const y of [b.y - pad, b.y + b.height + pad]) include(m, x, y);
      }
    }
    for (const child of node.children ?? []) visit(child, m, active, blocked, hasEffects, depth + 1);
  }
  for (const node of frame.children) visit(node, IDENTITY, false, false, false, 0);
  assert(found.size === wanted.size, 'CAMERA_TARGET_MISSING', 'A kept target is missing from the current world frame.');
  assert(xmax > xmin && ymax > ymin, 'CAMERA_FIT_FAILED', 'Kept targets need positive combined width and height.');
  const region = { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin },
    fit = fitRegion(
      region,
      { width: frame.width, height: frame.height },
      { padding: rule.padding, rotation: pose.rotation, anchorX: pose.anchorX, anchorY: pose.anchorY },
    );
  if (rule.ground === 'center') return fit;
  const c = Math.cos(fit.rotation),
    s = Math.sin(fit.rotation),
    halfHeight = (Math.abs(s) * region.width + Math.abs(c) * region.height) / 2,
    shift = (fit.anchorY * frame.height + fit.zoom * halfHeight - (frame.height - rule.padding)) / fit.zoom;
  return { ...fit, x: number(fit.x - s * shift, 'bottom fit x'), y: number(fit.y + c * shift, 'bottom fit y') };
}
