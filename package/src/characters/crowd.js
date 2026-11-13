import { assert, number, options } from '../core/validate.js';
import { character, compileCharacter } from './runtime.js';
import { bean, BEAN_PALETTES, SKIN, HAIR } from './builds/bean.js';
import { hash } from './timing.js';
import { surface, isSurface, restBounds, sceneLength } from './staging.js';

const f = (v) => Object.freeze(v);
const MAX_MEMBERS = 200;
const STYLES = ['short', 'bun', 'curly', 'none'],
  ACCESSORIES = ['none', 'none', 'none', 'glasses', 'none', 'hardhat'];
const pick = (list, seed, i, ch) => list[Math.floor(hash(seed, i, ch) * list.length)];

/** A seeded bean for a crowd given as a count, so a crowd of 20 is 20 different people, the same every run. */
function member(seed, i) {
  return bean({
    name: `crowd-${i}`,
    palette: pick(Object.keys(BEAN_PALETTES), seed, i, 11),
    skin: pick(Object.keys(SKIN), seed, i, 12),
    hair: pick(Object.keys(HAIR), seed, i, 13),
    hairStyle: pick(STYLES, seed, i, 14),
    accessory: pick(ACCESSORIES, seed, i, 15),
  });
}

/**
 * Stage a crowd standing in rows on a ground. Row 0 is the front row and stands on `ground`; each row
 * behind stands on the ground raised by `rise` (and scaled by depthScale), so farther rows are smaller and
 * higher. With stagger 'half' each row sits half a place off the row in front, so heads fall in the gaps;
 * the rise grows where needed so no head overlaps a head in the adjacent row. Members are painted back row
 * first and all carry `tag`, so the composition audit treats the crowd as one group and checks its footing.
 *
 * cast: an array of character definitions (one member each) or a count of seeded beans.
 * Returns {actors, spots, rows, surfaces, tag}; actors[i] and spots[i] belong to cast member i.
 * @param {import('../core/scene.js').Scene} scene
 * @param {number|any[]} cast
 * @param {{rows?:number,ground?:any,x0?:number,x1?:number,stagger?:'half'|'none',depthScale?:number,rise?:number,size?:number,height?:number|string,unit?:number,seed?:number,tag?:string|null,facing?:'center'|1|-1,each?:{idle?:boolean,shade?:any,secondaryMotion?:boolean},lod?:{below?:number,displayWidth?:number}}} [spec]
 */
export function crowd(scene, cast, spec = {}) {
  options(
    spec,
    [
      'rows',
      'ground',
      'x0',
      'x1',
      'stagger',
      'depthScale',
      'rise',
      'size',
      'height',
      'unit',
      'seed',
      'tag',
      'facing',
      'each',
      'lod',
    ],
    'crowd',
  );
  const seed = number(spec.seed ?? 1, 'crowd seed', 0, 4294967295) >>> 0;
  assert(
    typeof cast === 'number' || Array.isArray(cast),
    'INVALID_CROWD',
    'crowd takes an array of character definitions or a count.',
  );
  const count = typeof cast === 'number' ? number(cast, 'crowd size', 1, MAX_MEMBERS) : cast.length;
  assert(
    Number.isInteger(count) && count >= 1 && count <= MAX_MEMBERS,
    'INVALID_CROWD',
    `A crowd has 1 to ${MAX_MEMBERS} members.`,
  );
  const compiled = (typeof cast === 'number' ? Array.from({ length: count }, (_, i) => member(seed, i)) : cast).map(
    (d) => {
      assert(d && typeof d === 'object', 'INVALID_CROWD', 'Crowd members are character definitions.');
      return d.order ? d : compileCharacter(d);
    },
  );

  const perRow = Array.isArray(spec.ground);
  if (perRow)
    assert(
      spec.ground.length >= 1 && spec.ground.every(isSurface),
      'INVALID_CROWD',
      'ground is a surface() or a list of surfaces, front row first.',
    );
  else
    assert(
      spec.ground === undefined || isSurface(spec.ground),
      'INVALID_CROWD',
      'ground is a surface() or a list of surfaces, front row first.',
    );
  const ground = perRow ? spec.ground[0] : (spec.ground ?? surface({ y: scene.height * 0.8 }));
  const wanted = spec.rows ?? (perRow ? spec.ground.length : Math.round(Math.sqrt(count / 2.5)));
  assert(
    Number.isInteger(wanted) && wanted >= 1 && wanted <= 20,
    'INVALID_CROWD',
    'rows is a whole number from 1 to 20.',
  );
  assert(!perRow || wanted <= spec.ground.length, 'INVALID_CROWD', 'Give one surface per row.');
  const rows = Math.min(wanted, count);
  const x0 = number(spec.x0 ?? scene.width * 0.12, 'crowd x0'),
    x1 = number(spec.x1 ?? scene.width * 0.88, 'crowd x1');
  assert(x1 >= x0, 'INVALID_CROWD', 'crowd x1 must not be left of x0.');
  const stagger = spec.stagger ?? 'half';
  assert(stagger === 'half' || stagger === 'none', 'INVALID_CROWD', 'stagger is half or none.');
  const depth = number(spec.depthScale ?? 0.85, 'depthScale', 0.2, 1);
  const facing = spec.facing ?? 'center';
  assert(facing === 'center' || facing === 1 || facing === -1, 'INVALID_CROWD', 'facing is center, 1 or -1.');
  const tag = spec.tag === undefined ? 'crowd' : spec.tag;
  assert(
    tag === null || (typeof tag === 'string' && tag.length > 0),
    'INVALID_CROWD',
    'tag is a tag name, or null for none.',
  );
  const lod = spec.lod ?? null;
  if (lod) {
    options(lod, ['below', 'displayWidth'], 'crowd LOD');
    number(lod.below ?? 48, 'LOD screen height', 1, 1000);
    number(lod.displayWidth ?? scene.width, 'LOD display width', 120, 8192);
  }
  const lodKinds = new Array(count).fill('full');
  const each = spec.each ?? {};
  options(each, ['idle', 'shade', 'secondaryMotion'], 'crowd member');
  assert(
    [spec.size, spec.height].filter((v) => v !== undefined).length <= 1,
    'INVALID_CROWD',
    'Give a crowd size or height, not both.',
  );

  // Places: the fewest front-row places that hold everyone. Odd rows of a half stagger have one place fewer,
  // so they stay inside [x0, x1]. Front rows fill first; the last row keeps the places nearest the centre.
  const half = stagger === 'half' && rows > 1,
    cap = (n0, r) => (half && r % 2 ? n0 - 1 : n0);
  let n0 = half ? 2 : 1;
  while (Array.from({ length: rows }, (_, r) => cap(n0, r)).reduce((a, b) => a + b, 0) < count) n0++;
  assert(n0 === 1 || x1 > x0, 'INVALID_CROWD', 'A crowd wider than one place needs x1 right of x0.');
  const step = n0 > 1 ? (x1 - x0) / (n0 - 1) : 0,
    cx = (x0 + x1) / 2,
    layout = [];
  for (let r = 0, left = count; r < rows && left > 0; r++) {
    let places =
      n0 === 1 ? [cx] : Array.from({ length: cap(n0, r) }, (_, i) => x0 + (half && r % 2 ? step / 2 : 0) + i * step);
    if (places.length > left)
      places = places
        .map((x) => [Math.abs(x - cx), x])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .slice(0, left)
        .map((p) => p[1])
        .sort((a, b) => a - b);
    layout.push(places);
    left -= places.length;
  }

  // Sizes: a height for every front-row member, a size multiplier, or by default the largest size (≤ 1)
  // that leaves a tenth of a place between front-row bodies.
  const bounds = compiled.map((d) => restBounds(d));
  const unitSize =
    spec.height !== undefined
      ? null
      : spec.size !== undefined
        ? number(spec.size, 'crowd size multiplier', 0.01, 100)
        : n0 > 1
          ? Math.min(1, (0.9 * step) / Math.max(...bounds.map((b) => b.width)))
          : 1;
  const H = spec.height !== undefined ? sceneLength(spec.height, spec.unit, 'crowd height') : null;
  const spots = new Array(count),
    rowsOut = [];
  let i = 0;
  layout.forEach((places, r) => {
    const ids = [];
    for (const x of places) {
      const k = Math.pow(depth, r),
        size = H !== null ? (H * k) / bounds[i].height : unitSize * k;
      spots[i] = { x, size, row: r, facing: facing === 'center' ? (x > cx + 1e-9 ? -1 : 1) : facing };
      ids.push(i++);
    }
    rowsOut.push(f(ids));
  });

  // Row grounds. Each row rises 0.6 of the nearer row's body height (scaled per row when rise is given), then
  // more if a head would touch a head in the row in front: clearance 5% of that row's height.
  const surfaces = [ground],
    lifts = [0];
  if (!perRow) {
    for (let r = 1; r < rowsOut.length; r++) {
      const front = rowsOut[r - 1],
        back = rowsOut[r],
        tall = Math.max(...front.map((j) => spots[j].size * bounds[j].height)),
        margin = 0.05 * tall;
      let lift =
        lifts[r - 1] +
        (spec.rise !== undefined ? number(spec.rise, 'crowd rise', 0, 1e5) * Math.pow(depth, r - 1) : 0.6 * tall);
      const headX = (j) => {
        const h = bounds[j].head,
          s = spots[j].size * spots[j].facing,
          a = spots[j].x + s * h.x0,
          b = spots[j].x + s * h.x1;
        return [Math.min(a, b), Math.max(a, b)];
      };
      for (const a of front)
        for (const b of back) {
          const [ax0, ax1] = headX(a),
            [bx0, bx1] = headX(b);
          if (bx1 + margin <= ax0 || bx0 - margin >= ax1) continue;
          // back head bottom + margin ≤ front head top, with each row's ground under its own feet.
          const need =
            ground.yAt(spots[b].x) +
            spots[b].size * bounds[b].head.y1 +
            margin -
            (ground.yAt(spots[a].x) - lifts[r - 1] + spots[a].size * bounds[a].head.y0);
          lift = Math.max(lift, need);
        }
      lifts.push(lift);
      surfaces.push(ground.raise(lift));
    }
  } else for (let r = 1; r < rowsOut.length; r++) surfaces.push(spec.ground[r]);

  // Paint order is creation order: back row first.
  const actors = new Array(count);
  for (let r = rowsOut.length - 1; r >= 0; r--)
    for (const j of rowsOut[r]) {
      const p = spots[j];
      let definition = compiled[j];
      if (lod && (p.size * bounds[j].height * (lod.displayWidth ?? scene.width)) / scene.width < (lod.below ?? 48)) {
        // A flat vector impostor retains authored root/actions while dropping facial detail and shading.
        const core = definition.parts.filter(
          (part) => part.length || ['body', 'head', 'cell', 'tail', 'belly', 'footF', 'footB'].includes(part.id),
        );
        assert(core.length > 0, 'CROWD_LOD_UNSUPPORTED', 'This rig has no body/head/limb metadata for an impostor.');
        definition = {
          ...definition,
          parts: Object.freeze(core.map((part) => Object.freeze({ ...part, shade: false, secondary: null }))),
        };
        lodKinds[j] = 'impostor';
      }
      actors[j] = character(scene, definition, {
        ...each,
        x: p.x,
        standOn: surfaces[p.row],
        size: p.size,
        facing: p.facing,
        seed: (seed + j * 7919) >>> 0,
      });
      if (tag !== null) actors[j].handle.tag(tag);
    }
  return f({
    actors: f(actors),
    spots: f(spots.map((p) => f({ ...p, y: surfaces[p.row].yAt(p.x), surface: surfaces[p.row] }))),
    rows: f(rowsOut),
    surfaces: f(surfaces),
    tag,
    lod: f(lodKinds),
  });
}
