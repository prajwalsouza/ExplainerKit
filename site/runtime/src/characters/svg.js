import { assert, options } from '../core/validate.js';
import { importSVG } from '../import/svg.js';
import { compileCharacter, solveBones } from './runtime.js';
import { translate, bounds } from './shapes.js';
import { booleanPath } from '../geometry/shapes/boolean.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const d = (commands) => commands.map(([c, ...v]) => c + v.map((n) => +n.toFixed(2)).join(' ')).join('');
const f = (v) => Object.freeze(v);

/**
 * Write a character as an artist-editable SVG in its rest pose. Structure (all coordinates in character
 * space, ground at y = 0, no transforms, so editors that flatten transforms keep it intact):
 *   <g id="palette">  one swatch per slot tone: slot-<name>-base | -shade | -light
 *   <g id="pivots">   one circle per bone: pivot-<bone>; move it to move the joint
 *   <g id="registration"> mark-origin at (0, 0) and mark-unit at (0, -100); leave these where they are
 *   <g id="parts">    one group per part in draw order: <g id="<part>"> with <path id="<part>-art">;
 *                     extra paths drawn inside a static part's group are kept as decoration on its bone.
 * Procedural parts (faces, limbs, waves) are written for reference and marked data-procedural.
 */
export function exportCharacterSVG(definition, spec = {}) {
  options(spec, ['margin'], 'character SVG export');
  const def = definition.order ? definition : compileCharacter(definition),
    margin = spec.margin ?? 24;
  const pose = { ...def.rest },
    world = solveBones(def, pose),
    ctx = { def, seed: 1, size: 1, clips: [] };
  const art = def.parts.map((part) => {
    const origin = part.bone ? def.bones[part.bone].at : [0, 0];
    let local = part.draw ? part.draw(pose, world, ctx) : part.local;
    // Bake runtime clips (eyelids, bellies, stripes) into the shape so the file looks like the character.
    if (part.clip && !part.stroke && local.length)
      local = booleanPath('intersect', local, part.clip(pose, world, ctx)).commands;
    return { part, commands: translate(local, origin[0], origin[1]) };
  });
  const all = art.flatMap((a) => a.commands).filter((c) => c.length > 1),
    bb = bounds(all.length ? all : [['M', 0, 0]]);
  const x = bb.x - margin,
    y = bb.y - margin,
    w = bb.width + 2 * margin,
    h = bb.height + 2 * margin;
  const swatches = Object.entries(def.palette).flatMap(([slot, t], i) =>
    ['base', 'shade', 'light'].map(
      (k, j) =>
        `<rect id="slot-${esc(slot)}-${k}" x="${(x + 4 + j * 9).toFixed(1)}" y="${(y + 4 + i * 9).toFixed(1)}" width="8" height="8" fill="${esc(t[k])}"/>`,
    ),
  );
  const pivots = def.order.map(
    (b) =>
      `<circle id="pivot-${esc(b)}" cx="${def.bones[b].at[0]}" cy="${def.bones[b].at[1]}" r="2.5" fill="#ff2d6f"/>`,
  );
  const groups = art.map(({ part, commands }) => {
    const t = def.palette[part.slot],
      paint = part.stroke
        ? `fill="none" stroke="${esc(t.base)}" stroke-width="${part.stroke}" stroke-linecap="round" stroke-linejoin="round"`
        : `fill="${esc(t.base)}"`;
    return `<g id="${esc(part.id)}" data-bone="${esc(part.bone ?? '')}" data-slot="${esc(part.slot)}"${part.draw ? ' data-procedural="true"' : ''}><path id="${esc(part.id)}-art" d="${d(commands)}" ${paint}${part.opacity != null && part.opacity !== 1 ? ` opacity="${part.opacity}"` : ''}/></g>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" data-explainerkit-character="${esc(def.name)}" data-rig="${esc(def.rig ?? '')}">
<title>${esc(def.name)}: ExplainerKit character (${esc(def.meta?.license ?? 'CC0-1.0')})</title>
<g id="parts">
${groups.join('\n')}
</g>
<g id="pivots">
${pivots.join('\n')}
</g>
<g id="palette">
${swatches.join('\n')}
</g>
<g id="registration" opacity="0.4"><circle id="mark-origin" cx="0" cy="0" r="1.5" fill="#00a0ff"/><circle id="mark-unit" cx="0" cy="-100" r="1.5" fill="#00a0ff"/></g>
</svg>
`;
}

// Affine helpers for walking an imported blueprint's TRS groups.
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const trs = (p) => {
  const c = Math.cos(p.rotation ?? 0),
    s = Math.sin(p.rotation ?? 0),
    sx = p.scaleX ?? 1,
    sy = p.scaleY ?? 1;
  return [c * sx, s * sx, -s * sy, c * sy, p.x ?? 0, p.y ?? 0];
};
const apply = (m, commands) =>
  commands.map(([c, ...v]) => {
    const out = [c];
    for (let i = 0; i < v.length; i += 2)
      out.push(m[0] * v[i] + m[2] * v[i + 1] + m[4], m[1] * v[i] + m[3] * v[i + 1] + m[5]);
    return f(out);
  });

/** Every path in an imported blueprint with its full transform, grouped under the nearest named ancestor. */
function collect(result) {
  const named = new Map(result.parts.map((p) => [p.path, p.id])),
    out = [];
  const walk = (node, path, m, owner) => {
    const here = mul(m, trs(node.props)),
      id = named.get(path.join('.')) ?? null;
    if (node.type === 'path')
      out.push({
        id,
        owner: id ?? owner,
        commands: apply(here, node.props.commands),
        fill: node.props.fill,
        stroke: node.props.stroke,
      });
    for (const [name, child] of Object.entries(node.children ?? {})) walk(child, [...path, name], here, id ?? owner);
  };
  walk(result.blueprint, [], [1, 0, 0, 1, 0, 0], null);
  return out;
}

/**
 * Load an artist-edited character SVG back onto its rig. Moved pivot circles move joints, recolored swatches
 * recolor the palette, edited <part>-art paths replace static artwork, and extra paths drawn inside a part's
 * group become decoration that follows that part's bone. Procedural parts keep their code but take the
 * edited colors. Returns a new definition for character().
 */
export function characterFromSVG(definition, source, spec = {}) {
  options(spec, ['DOMParser'], 'character SVG import');
  const base = definition.order ? definition : compileCharacter(definition);
  const imported = importSVG(source, { DOMParser: spec.DOMParser, maxNodes: 4000 }),
    paths = collect(imported);
  // importSVG fits the viewBox into width × height; undo that by measuring the root pivot through the same transform.
  const center = (id) => {
    const p = paths.find((q) => q.id === id);
    return p ? [bounds(p.commands).cx, bounds(p.commands).cy] : null;
  };
  const pivots = Object.fromEntries(base.order.map((b) => [b, center(`pivot-${b}`)]));
  const known = base.order.filter((b) => pivots[b]),
    origin = center('mark-origin'),
    unit = center('mark-unit');
  assert(
    known.length > 0 && origin && unit,
    'INVALID_CHARACTER_SVG',
    'Missing pivot-<bone> circles or registration marks; export with exportCharacterSVG first.',
  );
  // The registration marks recover the editor's placement and scale, independent of any pivot edits.
  const scale = Math.hypot(unit[0] - origin[0], unit[1] - origin[1]) / 100,
    offset = [origin[0] / scale, origin[1] / scale];
  const toChar = (commands) => commands.map(([c, ...v]) => f([c, ...v.map((n, i) => n / scale - offset[i % 2])]));
  const bones = Object.fromEntries(
    base.order.map((name) => [
      name,
      {
        ...base.bones[name],
        at: pivots[name]
          ? [pivots[name][0] / scale - offset[0], pivots[name][1] / scale - offset[1]]
          : base.bones[name].at,
      },
    ]),
  );
  const palette = { ...base.palette };
  for (const slot of Object.keys(palette)) {
    const read = (k) => paths.find((p) => p.id === `slot-${slot}-${k}`)?.fill;
    palette[slot] = f({
      base: read('base') ?? palette[slot].base,
      shade: read('shade') ?? palette[slot].shade,
      light: read('light') ?? palette[slot].light,
    });
  }
  const parts = [];
  for (const part of base.parts) {
    const { local, ...rest } = part;
    const edited = !part.draw && paths.find((p) => p.id === `${part.id}-art`);
    parts.push(
      edited
        ? { ...rest, commands: toChar(edited.commands) }
        : part.draw
          ? rest
          : {
              ...rest,
              commands: translate(local, base.bones[part.bone]?.at[0] ?? 0, base.bones[part.bone]?.at[1] ?? 0),
            },
    );
    // Decoration: unnamed paths an artist added inside this part's group.
    paths
      .filter((p) => p.owner === part.id && p.id !== `${part.id}-art` && !part.draw)
      .forEach((p, i) => {
        const slot = `deco-${part.id}-${i}`,
          color = typeof p.fill === 'string' && p.fill !== 'none' ? p.fill : '#000000';
        palette[slot] = f({ base: color, shade: color, light: color });
        parts.push({
          id: `${part.id}-deco${i}`,
          bone: part.bone,
          z: part.z + 0.01 * (i + 1),
          slot,
          shade: false,
          commands: toChar(p.commands),
        });
      });
  }
  return compileCharacter({
    ...Object.fromEntries(Object.entries(base).filter(([k]) => !['order', 'parts', 'bones', 'palette'].includes(k))),
    bones,
    palette,
    parts,
  });
}
