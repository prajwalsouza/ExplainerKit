import { localBounds } from '../core/transform.js';
import { stateOf } from './point-set.js';
const provenance = new WeakMap();
/** Private, nonserialized evidence attached to the exact geometry produced by instance(). */
export function registerInstanceProvenance(plan, set, tag) {
  const state = stateOf(set),
    domain = set.diagnostics.bounds;
  let fallback = null;
  if (!domain && state.count) {
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (let i = 0; i < state.count; i++) {
      x = Math.min(x, state.x[i]);
      y = Math.min(y, state.y[i]);
      right = Math.max(right, state.x[i]);
      bottom = Math.max(bottom, state.y[i]);
    }
    fallback = { x, y, width: right - x, height: bottom - y };
  }
  const field = domain ?? fallback;
  if (!field || field.width <= 0 || field.height <= 0) return;
  let x = Infinity,
    y = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const record of plan) {
    if (record.props.commands) {
      for (const c of record.props.commands)
        for (let i = 1; i < c.length; i += 2) {
          x = Math.min(x, c[i]);
          y = Math.min(y, c[i + 1]);
          right = Math.max(right, c[i]);
          bottom = Math.max(bottom, c[i + 1]);
        }
    } else {
      const b = localBounds({ type: record.type, props: record.props, children: [] });
      x = Math.min(x, b.x);
      y = Math.min(y, b.y);
      right = Math.max(right, b.x + b.width);
      bottom = Math.max(bottom, b.y + b.height);
    }
  }
  if (!(right > x && bottom > y)) return;
  const width = right - x,
    height = bottom - y,
    inside =
      Math.max(0, Math.min(right, field.x + field.width) - Math.max(x, field.x)) *
      Math.max(0, Math.min(bottom, field.y + field.height) - Math.max(y, field.y)),
    outside = 1 - inside / (width * height);
  const evidence = Object.freeze({
    kind: 'procedural-instance',
    field: Object.freeze({ ...field }),
    geometry: Object.freeze({ x, y, width, height }),
    outside,
    tag: tag ?? null,
  });
  for (const record of plan) {
    const geometry = record.props.commands ?? record.props.points;
    if (geometry) provenance.set(geometry, evidence);
  }
}
export function instanceGeometryFindings(frame, tagsOf = () => [], threshold = 0.75) {
  const findings = [],
    seen = new Set();
  function visit(node, root) {
    const p = node.props ?? {},
      evidence = provenance.get(p.commands ?? p.points);
    if (evidence && !seen.has(evidence) && evidence.outside > threshold) {
      seen.add(evidence);
      const tags = tagsOf(root),
        tag = evidence.tag ?? tags.at(-1) ?? root;
      findings.push({
        rule: 'instanceGeometry',
        severity: 'warning',
        ids: [root, node.id],
        message: `Instanced geometry in ${tag} lies ${Math.round(evidence.outside * 100)}% outside its field bounds; use local shape coordinates rather than absolute scene coordinates.`,
        value: evidence.outside,
        tag,
        evidence: 'measured-instance-field-bounds',
        fieldBounds: evidence.field,
        geometryBounds: evidence.geometry,
      });
    }
    for (const child of node.children ?? []) visit(child, root);
  }
  for (const node of frame.children) visit(node, node.id);
  return findings;
}
