import { assert, number, options, safeCopy } from '../core/validate.js';
import { color } from './index.js';
export function sceneLight(spec = {}) {
  const v = safeCopy(spec);
  options(v, ['angle', 'color', 'ambient'], 'scene light');
  return Object.freeze({
    angle: number(v.angle ?? -Math.PI / 4, 'light angle'),
    color: color(v.color ?? '#fff3d6', { stop: true }),
    ambient: color(v.ambient ?? '#1b2a4a', { stop: true }),
  });
}
/** Inner alpha differences are stylized flat artwork, not physical illumination. */
export function validateShade(value) {
  if (value === null) return null;
  const v = safeCopy(value);
  options(v, ['shadow', 'light', 'rim', 'highlight'], 'shade');
  const result = {};
  for (const role of ['shadow', 'light'])
    if (v[role] !== undefined) {
      const p = v[role];
      options(p, ['color', 'amount', 'softness', 'distance'], role);
      result[role] = Object.freeze({
        color: p.color == null ? null : color(p.color, { stop: true }),
        amount: number(p.amount ?? 0.4, `${role} amount`, 0, 1),
        softness: number(p.softness ?? 0.35, `${role} softness`, 0, 1),
        distance: number(p.distance ?? 8, `${role} distance`, 0, 64),
      });
    }
  if (v.rim !== undefined) {
    options(v.rim, ['color', 'width', 'amount'], 'rim');
    result.rim = Object.freeze({
      color: v.rim.color == null ? null : color(v.rim.color, { stop: true }),
      width: number(v.rim.width ?? 2, 'rim width', 0, 32),
      amount: number(v.rim.amount ?? 1, 'rim amount', 0, 1),
    });
  }
  if (v.highlight !== undefined) {
    const p = v.highlight;
    options(p, ['color', 'amount', 'x', 'y', 'r'], 'highlight');
    result.highlight = Object.freeze({
      color: p.color == null ? null : color(p.color, { stop: true }),
      amount: number(p.amount ?? 0.5, 'highlight amount', 0, 1),
      x: number(p.x ?? 0, 'highlight x'),
      y: number(p.y ?? 0, 'highlight y'),
      r: number(p.r ?? 8, 'highlight radius', 0.01, 64),
    });
  }
  assert(Object.keys(result).length > 0, 'INVALID_SHADE', 'Shade requires shadow, light, rim or highlight.');
  return Object.freeze(result);
}
export function shadePasses(shade, light, localAngle) {
  const out = [];
  for (const role of ['shadow', 'light', 'rim']) {
    const p = shade?.[role];
    if (!p) continue;
    const distance = role === 'rim' ? p.width : p.distance,
      sign = role === 'shadow' ? 1 : -1;
    out.push({
      role,
      color: p.color ?? (role === 'shadow' ? light.ambient : light.color),
      amount: p.amount,
      dx: sign * Math.cos(localAngle) * distance,
      dy: sign * Math.sin(localAngle) * distance,
      blur: role === 'rim' ? 0 : p.softness * distance,
    });
  }
  return out;
}
