import { hsla, toHSLA } from '../../color/space.js';
import { randomAt } from '../../noise/vector.js';
import {
  clipConvex,
  offsetRing,
  orientedBox,
  pointInRing,
  rgb,
  ringDistance,
  shade,
  simplifyRing,
  triangulate,
} from './mesh.js';

// The building grammar. A building is a footprint, a height, a kind and a seed. From those the
// kit decides a facade (material, window style, bay rhythm, ground floor), a roof and the parts
// that stand proud of the wall: plinth, string course, cornice, balconies, awnings, shop signs,
// steps, chimneys and roof plant. Windows are not modelled as geometry. Each wall carries its
// bay and floor layout, and the renderer draws the windows from that, so the same layout also
// tells it which windows to light at night.

/** Wall materials, in the order the renderer's facade shader numbers them. */
export const wallMaterials = Object.freeze(['plaster', 'brick', 'concrete', 'stone', 'metal', 'glass', 'timber']);
/** Window styles, in the order the facade shader numbers them. */
export const windowStyles = Object.freeze(['sash', 'wide', 'arched', 'ribbon', 'high', 'none']);
/** Ground-floor styles, in the order the facade shader numbers them. */
export const groundStyles = Object.freeze(['home', 'shop', 'gate', 'blank']);
/** Roof surface materials, in the order the roof shader numbers them. */
export const roofMaterials = Object.freeze(['tile', 'slate', 'gravel', 'membrane', 'metal', 'green']);

// Palettes are lists of [hue, saturation, lightness, weight]. They are sRGB swatches chosen
// from photographs of ordinary streets, kept low in saturation so sunlight does the work.
const P = (list) => Object.freeze(list.map((c) => Object.freeze(c)));
const PALETTES = Object.freeze({
  // Mixed northern European town: brick and plaster side by side.
  temperate: {
    plaster: P([
      [42, 30, 82, 3],
      [36, 34, 74, 3],
      [28, 30, 68, 2],
      [48, 18, 88, 3],
      [18, 28, 70, 1],
      [210, 10, 78, 1],
      [90, 12, 72, 1],
      [12, 34, 62, 1],
    ]),
    brick: P([
      [14, 42, 38, 3],
      [10, 46, 32, 2],
      [20, 38, 44, 2],
      [26, 34, 50, 1],
      [8, 30, 26, 1],
      [32, 36, 58, 1],
    ]),
    stone: P([
      [40, 14, 70, 3],
      [36, 18, 62, 2],
      [30, 8, 56, 1],
      [44, 20, 76, 2],
    ]),
    concrete: P([
      [40, 5, 66, 2],
      [30, 4, 58, 2],
      [210, 5, 62, 1],
      [45, 8, 74, 1],
    ]),
    metal: P([
      [210, 8, 60, 2],
      [200, 10, 46, 1],
      [40, 6, 70, 1],
      [150, 12, 40, 1],
      [8, 40, 36, 1],
    ]),
    timber: P([
      [24, 38, 34, 2],
      [30, 30, 46, 1],
      [8, 50, 34, 2],
      [50, 40, 60, 1],
    ]),
    glass: P([
      [205, 22, 34, 2],
      [190, 18, 30, 1],
      [215, 16, 40, 1],
    ]),
    mix: {
      residential: [3, 4, 0, 0, 0, 0, 1],
      apartment: [4, 4, 2, 0, 0, 0, 0],
      commercial: [4, 3, 1, 1, 0, 0, 0],
      office: [1, 1, 3, 1, 0, 3, 0],
      industrial: [0, 2, 2, 0, 5, 0, 0],
      civic: [2, 2, 1, 5, 0, 0, 0],
      religious: [1, 3, 0, 6, 0, 0, 0],
    },
    tile: P([
      [14, 52, 40, 4],
      [20, 50, 46, 2],
      [8, 40, 32, 2],
      [26, 30, 34, 1],
    ]),
    slate: P([
      [215, 8, 30, 3],
      [200, 6, 24, 2],
      [30, 6, 34, 1],
    ]),
  },
  // Dutch and English streets: dark brick, white trim, slate and red tile.
  brick: {
    plaster: P([
      [44, 22, 84, 2],
      [40, 12, 90, 2],
      [30, 20, 70, 1],
      [0, 0, 18, 1],
    ]),
    brick: P([
      [12, 42, 30, 4],
      [8, 40, 24, 3],
      [16, 44, 36, 3],
      [22, 36, 42, 2],
      [4, 22, 18, 2],
      [30, 30, 52, 1],
      [26, 40, 62, 1],
    ]),
    stone: P([
      [38, 14, 66, 2],
      [34, 16, 58, 1],
    ]),
    concrete: P([
      [40, 5, 64, 1],
      [30, 4, 56, 1],
    ]),
    metal: P([
      [210, 8, 56, 1],
      [200, 10, 40, 1],
      [0, 0, 20, 1],
    ]),
    timber: P([
      [150, 30, 18, 2],
      [0, 0, 14, 2],
      [24, 36, 30, 1],
    ]),
    glass: P([
      [205, 22, 32, 1],
      [190, 18, 28, 1],
    ]),
    mix: {
      residential: [1, 9, 0, 0, 0, 0, 0.6],
      apartment: [1, 8, 1, 0, 0, 0, 0],
      commercial: [1, 7, 0.5, 0.5, 0, 0, 0],
      office: [0, 4, 2, 1, 0, 3, 0],
      industrial: [0, 5, 1, 0, 4, 0, 0],
      civic: [0.5, 5, 0, 4, 0, 0, 0],
      religious: [0, 6, 0, 4, 0, 0, 0],
    },
    tile: P([
      [12, 50, 36, 3],
      [16, 48, 42, 2],
      [20, 20, 22, 2],
    ]),
    slate: P([
      [215, 8, 26, 3],
      [200, 6, 20, 2],
    ]),
  },
  // Nordic and Baltic centres: pale plaster in warm pastels over stone bases.
  pastel: {
    plaster: P([
      [44, 52, 76, 4],
      [38, 48, 70, 3],
      [28, 40, 72, 2],
      [12, 36, 72, 2],
      [48, 30, 86, 3],
      [95, 16, 72, 1],
      [200, 16, 76, 1],
      [20, 30, 62, 1],
      [0, 0, 90, 1],
    ]),
    brick: P([
      [14, 44, 40, 2],
      [20, 40, 46, 1],
      [32, 36, 60, 1],
    ]),
    stone: P([
      [40, 12, 68, 3],
      [30, 8, 54, 2],
      [20, 14, 50, 1],
      [44, 18, 76, 1],
    ]),
    concrete: P([
      [40, 5, 68, 2],
      [30, 4, 60, 1],
      [45, 8, 76, 1],
    ]),
    metal: P([
      [210, 8, 62, 2],
      [150, 20, 42, 1],
      [40, 6, 72, 1],
    ]),
    timber: P([
      [8, 56, 36, 3],
      [46, 56, 62, 2],
      [0, 0, 92, 1],
      [200, 20, 50, 1],
    ]),
    glass: P([
      [205, 22, 36, 2],
      [190, 18, 30, 1],
    ]),
    mix: {
      residential: [5, 1, 0, 0, 0, 0, 3],
      apartment: [7, 1, 1, 1, 0, 0, 0],
      commercial: [6, 1, 1, 2, 0, 0, 0],
      office: [3, 0, 2, 2, 0, 3, 0],
      industrial: [1, 2, 2, 0, 5, 0, 0],
      civic: [4, 0, 0, 5, 0, 0, 0],
      religious: [3, 1, 0, 5, 0, 0, 0],
    },
    tile: P([
      [14, 46, 36, 2],
      [215, 8, 30, 2],
      [150, 24, 38, 2],
      [0, 0, 22, 2],
    ]),
    slate: P([
      [215, 8, 28, 3],
      [150, 22, 36, 2],
      [200, 6, 22, 2],
    ]),
  },
  // Southern towns: warm whites and ochres under terracotta.
  mediterranean: {
    plaster: P([
      [40, 36, 88, 4],
      [36, 50, 76, 3],
      [24, 52, 68, 2],
      [14, 50, 66, 2],
      [46, 56, 72, 2],
      [0, 0, 94, 2],
      [8, 44, 60, 1],
    ]),
    brick: P([
      [18, 46, 46, 1],
      [24, 40, 54, 1],
    ]),
    stone: P([
      [40, 22, 74, 3],
      [36, 26, 66, 2],
      [44, 28, 80, 1],
    ]),
    concrete: P([
      [40, 8, 72, 1],
      [36, 10, 64, 1],
    ]),
    metal: P([
      [210, 6, 64, 1],
      [40, 8, 72, 1],
    ]),
    timber: P([
      [24, 40, 36, 1],
      [150, 30, 30, 1],
      [215, 40, 40, 1],
    ]),
    glass: P([
      [205, 22, 38, 1],
      [190, 18, 32, 1],
    ]),
    mix: {
      residential: [9, 0.5, 0, 1, 0, 0, 0],
      apartment: [8, 0.5, 1, 1, 0, 0, 0],
      commercial: [7, 0.5, 1, 2, 0, 0, 0],
      office: [3, 0, 3, 1, 0, 3, 0],
      industrial: [3, 1, 3, 0, 3, 0, 0],
      civic: [3, 0, 0, 6, 0, 0, 0],
      religious: [3, 0, 0, 6, 0, 0, 0],
    },
    tile: P([
      [16, 58, 46, 4],
      [20, 54, 52, 3],
      [12, 50, 40, 2],
    ]),
    slate: P([
      [16, 50, 42, 2],
      [215, 8, 34, 1],
    ]),
  },
  // Recent districts: pale render, dark panels, a lot of glass.
  modern: {
    plaster: P([
      [40, 6, 90, 4],
      [30, 4, 78, 2],
      [210, 6, 70, 1],
      [0, 0, 24, 2],
      [36, 24, 70, 1],
      [14, 30, 52, 1],
    ]),
    brick: P([
      [20, 14, 34, 2],
      [30, 12, 56, 2],
      [14, 34, 40, 1],
      [0, 0, 20, 1],
    ]),
    stone: P([
      [40, 8, 72, 2],
      [30, 5, 58, 1],
    ]),
    concrete: P([
      [40, 4, 70, 3],
      [30, 3, 60, 2],
      [210, 5, 54, 1],
    ]),
    metal: P([
      [210, 8, 58, 2],
      [200, 8, 34, 2],
      [30, 30, 40, 1],
      [40, 6, 78, 1],
    ]),
    timber: P([
      [28, 36, 46, 2],
      [24, 30, 34, 1],
    ]),
    glass: P([
      [205, 24, 34, 3],
      [190, 20, 30, 2],
      [215, 18, 42, 1],
      [170, 16, 34, 1],
    ]),
    mix: {
      residential: [5, 2, 1, 0, 0.5, 0, 1.5],
      apartment: [4, 2, 3, 0, 1, 0.5, 0.3],
      commercial: [2, 1, 2, 0.5, 1.5, 2, 0],
      office: [0.5, 0.5, 2, 0.5, 1, 6, 0],
      industrial: [0.5, 0.5, 2, 0, 6, 0, 0],
      civic: [2, 1, 3, 2, 0.5, 2, 0],
      religious: [3, 2, 2, 3, 0, 0, 0],
    },
    tile: P([
      [215, 8, 28, 3],
      [0, 0, 24, 2],
      [16, 40, 40, 1],
    ]),
    slate: P([
      [215, 8, 26, 3],
      [0, 0, 20, 2],
    ]),
  },
});
export const cityPalettes = Object.freeze(Object.keys(PALETTES));

const DOORS = P([
  [150, 34, 22, 3],
  [8, 52, 30, 2],
  [215, 40, 28, 2],
  [0, 0, 14, 3],
  [28, 36, 30, 3],
  [46, 50, 50, 1],
  [0, 0, 90, 2],
  [200, 30, 40, 1],
]);
const AWNINGS = P([
  [6, 56, 40, 3],
  [150, 36, 28, 3],
  [215, 44, 34, 2],
  [42, 60, 60, 2],
  [0, 0, 16, 2],
  [30, 24, 80, 2],
  [22, 62, 48, 1],
  [280, 22, 36, 1],
]);
const SIGNS = P([
  [0, 0, 12, 4],
  [0, 0, 94, 3],
  [8, 62, 42, 2],
  [150, 40, 26, 2],
  [215, 50, 36, 2],
  [42, 70, 56, 2],
  [22, 66, 50, 1],
  [330, 40, 44, 1],
  [180, 40, 34, 1],
]);
const TRIM_LIGHT = [44, 16, 88];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function weighted(list, u, weightAt = 3) {
  let total = 0;
  for (const c of list) total += c[weightAt];
  let t = u * total;
  for (const c of list) {
    t -= c[weightAt];
    if (t <= 0) return c;
  }
  return list[list.length - 1];
}
function pickIndex(weights, u) {
  let total = 0;
  for (const w of weights) total += w;
  let t = u * total;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i];
    if (t <= 0) return i;
  }
  return weights.length - 1;
}

/**
 * Decide how one building looks. Pure and deterministic: the same building, palette and seed
 * give the same answer. Values that the map did not supply are listed in `inferred`.
 */
export function buildingStyle(b, spec = {}) {
  const palette = PALETTES[spec.palette ?? 'temperate'] ?? PALETTES.temperate;
  const seed = spec.seed ?? 1;
  const region = spec.style ?? {};
  const id = Number(b.id) % 2147483647;
  const r = (k) => randomAt(seed, id, k);
  const inferred = [];
  const pitched = b.roofShape !== 'flat';
  // An older building has a cornice, tall windows and small panes. A recent one has wide
  // windows, glass balconies and flat walls. Height and footprint hint at which it is.
  const recentChance =
    { residential: 0.18, apartment: 0.4, commercial: 0.3, office: 0.75, industrial: 0.8, civic: 0.3, religious: 0.03 }[
      b.kind
    ] ?? 0.3;
  const recent =
    r(1) <
    clamp(
      recentChance +
        (b.levels >= 8 ? 0.4 : 0) -
        (pitched ? 0.25 : 0) +
        (spec.palette === 'modern' ? 0.35 : 0) +
        (region.recent ?? 0),
      0,
      1,
    );
  // Material: the tag when the kit can draw it, else a weighted choice for this kind.
  const tagged = {
    brick: 1,
    plaster: 0,
    stucco: 0,
    cement_block: 2,
    concrete: 2,
    stone: 3,
    sandstone: 3,
    limestone: 3,
    granite: 3,
    marble: 3,
    metal: 4,
    steel: 4,
    glass: 5,
    wood: 6,
    timber_framing: 6,
    masonry: 3,
  }[b.material];
  let material = tagged;
  if (material === undefined) {
    material = pickIndex(palette.mix[b.kind] ?? palette.mix.apartment, r(2));
    if (!recent && material === 5) material = 2;
    inferred.push('material');
  }
  const swatches = palette[wallMaterials[material]];
  let wall;
  if (b.wallColor) wall = toHSLA(b.wallColor);
  else {
    const c = weighted(swatches, r(3));
    wall = {
      h: c[0] + (r(4) - 0.5) * 6,
      s: clamp(c[1] + (r(5) - 0.5) * 8, 0, 100),
      l: clamp(c[2] + (r(6) - 0.5) * 8, 4, 96),
    };
    inferred.push('wallColor');
  }
  // Windows and ground floor by kind.
  let window = 0,
    ground = 0,
    bay = 2.6 + r(7) * 0.8;
  if (b.kind === 'residential') {
    window = recent ? 1 : 0;
    bay = recent ? 3.2 + r(7) * 0.8 : 2.3 + r(7) * 0.7;
  } else if (b.kind === 'apartment') {
    window = recent ? 1 : 0;
    bay = recent ? 3.3 + r(7) * 1.0 : 2.4 + r(7) * 0.7;
  } else if (b.kind === 'commercial') {
    window = recent ? 1 : 0;
    ground = 1;
    bay = recent ? 3.4 + r(7) * 1.0 : 2.5 + r(7) * 0.8;
  } else if (b.kind === 'office') {
    window = material === 5 ? 3 : recent ? 3 : 0;
    ground = r(8) < 0.5 ? 1 : 0;
    bay = material === 5 ? 1.5 : 2.4 + r(7) * 0.9;
  } else if (b.kind === 'industrial') {
    window = 4;
    ground = 2;
    bay = 4.5 + r(7) * 2;
  } else if (b.kind === 'civic') {
    window = !recent && r(8) < 0.4 ? 2 : recent ? 1 : 0;
    bay = 2.8 + r(7) * 0.9;
  } else if (b.kind === 'religious') {
    window = 2;
    ground = 3;
    bay = 3.6 + r(7) * 1.2;
  }
  if (b.groundFloor === 'shop') ground = 1;
  if (b.tag === 'garage' || b.tag === 'garages' || b.tag === 'carport') {
    window = 5;
    ground = 2;
  } else if (b.tag === 'shed' || b.tag === 'hut' || b.tag === 'roof' || b.area < 14) {
    window = 5;
    ground = 3;
  }
  // Roof.
  let roofMaterial, roof;
  if (pitched) {
    const slateChance = material === 3 || b.kind === 'religious' || b.kind === 'civic' ? 0.6 : 0.3;
    roofMaterial = b.roofMaterial === 'metal' ? 4 : b.roofMaterial === 'slate' ? 1 : r(9) < slateChance ? 1 : 0;
    const c = weighted(roofMaterial === 1 ? palette.slate : palette.tile, r(10));
    roof = {
      h: c[0] + (r(11) - 0.5) * 5,
      s: clamp(c[1] + (r(12) - 0.5) * 8, 0, 100),
      l: clamp(c[2] + (r(13) - 0.5) * 6, 4, 90),
    };
  } else {
    roofMaterial = b.kind === 'industrial' ? (r(9) < 0.5 ? 4 : 3) : r(9) < 0.08 && recent ? 5 : r(9) < 0.55 ? 2 : 3;
    const flat = [
      [40, 6, 52],
      [30, 5, 38],
      [210, 6, 44],
      [45, 8, 62],
      [100, 26, 36],
    ][roofMaterial === 5 ? 4 : Math.floor(r(10) * 4)];
    roof = { h: flat[0], s: flat[1], l: clamp(flat[2] + (r(13) - 0.5) * 10, 4, 90) };
  }
  if (b.roofColor) roof = toHSLA(b.roofColor);
  else inferred.push('roofColor');
  // Trim is usually pale; on a pale wall it goes a shade darker or picks up stone.
  const trimLight = wall.l < 62 || material === 1;
  const trim = trimLight
    ? { h: TRIM_LIGHT[0], s: TRIM_LIGHT[1], l: TRIM_LIGHT[2] - r(14) * 8 }
    : { h: wall.h, s: wall.s * 0.5, l: clamp(wall.l + (r(14) < 0.5 ? 10 : -22), 8, 95) };
  const door = weighted(DOORS, r(15));
  const balconyKinds =
    b.kind === 'apartment'
      ? [3, 3, 2, 2]
      : b.kind === 'residential' && b.levels >= 3
        ? [6, 1, 1, 1]
        : b.kind === 'commercial'
          ? [7, 1, 1, 1]
          : [1, 0, 0, 0];
  // A style with many balconies moves weight away from the no-balcony choice to the patterns.
  const balconyWeights = balconyKinds.map((w, i) => (i === 0 ? w / Math.max(0.2, region.balconies ?? 1) : w));
  const balcony = b.levels >= 2 && window !== 3 && window !== 4 && window !== 5 ? pickIndex(balconyWeights, r(16)) : 0;
  // Louvred shutters beside tall windows, common round the Mediterranean.
  const shutters = !recent && window === 0 && r(23) < (region.shutters ?? 0);
  const cornice = !recent && !pitched && b.kind !== 'industrial' && window !== 5 && r(17) < 0.8;
  const course = !recent && b.levels >= 2 && window !== 5 && (ground === 1 || r(18) < 0.5) && b.kind !== 'industrial';
  const plinth = b.kind !== 'industrial' && material !== 5 && window !== 5 && r(19) < 0.75;
  return {
    id: b.id,
    kind: b.kind,
    recent,
    material,
    window,
    ground,
    bay,
    wall: hsla(wall.h, wall.s, wall.l),
    wallHSL: wall,
    trim: hsla(trim.h, trim.s, trim.l),
    door: hsla(door[0], door[1], door[2]),
    roof: hsla(roof.h, roof.s, roof.l),
    roofMaterial,
    balcony,
    shutters,
    awnings: region.awnings ?? 0.5,
    chimneys: region.chimneys ?? 1,
    cornice,
    course,
    plinth,
    seed: r(20),
    inferred,
    r,
  };
}

/** How many bays fit a wall, and how wide each is. A wall too short for a window has none. */
export function bayLayout(length, target) {
  const margin = clamp(length * 0.08, 0.35, 0.9);
  const count = length < 2.1 ? 0 : Math.max(1, Math.floor((length - 2 * margin) / target + 0.35));
  return { margin, count, width: count ? (length - 2 * margin) / count : 0 };
}

// The roof as the lowest of a few sloping planes, each [gx, gy, c]: height = gx*x + gy*y + c
// above the eave, in map coordinates (x east, y north).
function roofPlanes(shape, box, rise) {
  const { cx, cy, lx, ly, sx, sy, hl, hs } = box;
  const plane = (dx, dy, half, slope) => {
    // slope * (half - ((p - c) . d))
    return [-slope * dx, -slope * dy, slope * (half + cx * dx + cy * dy)];
  };
  const s = rise / Math.max(0.5, hs);
  if (shape === 'gabled') return [plane(sx, sy, hs, s), plane(-sx, -sy, hs, s)];
  if (shape === 'hipped') {
    if (hl - hs < 0.8)
      return [
        plane(sx, sy, hs, s),
        plane(-sx, -sy, hs, s),
        plane(lx, ly, hl, rise / hl),
        plane(-lx, -ly, hl, rise / hl),
      ];
    return [plane(sx, sy, hs, s), plane(-sx, -sy, hs, s), plane(lx, ly, hl, s), plane(-lx, -ly, hl, s)];
  }
  if (shape === 'pyramidal')
    return [plane(sx, sy, hs, s), plane(-sx, -sy, hs, s), plane(lx, ly, hl, rise / hl), plane(-lx, -ly, hl, rise / hl)];
  // skillion: one slope across the short side
  return [plane(sx, sy, hs, rise / (2 * Math.max(0.5, hs)))];
}
const planeAt = (pl, x, y) => pl[0] * x + pl[1] * y + pl[2];
function roofAt(planes, x, y) {
  let h = Infinity;
  for (const pl of planes) h = Math.min(h, planeAt(pl, x, y));
  return h;
}
// Heights along an edge from p to q, split where the lowest plane changes: [[t, h], ...].
function profile(planes, p, q) {
  const ts = [0, 1];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++) {
      const a = planeAt(planes[i], p.x, p.y) - planeAt(planes[j], p.x, p.y),
        b = planeAt(planes[i], q.x, q.y) - planeAt(planes[j], q.x, q.y);
      if (a * b < 0) ts.push(a / (a - b));
    }
  ts.sort((a, b) => a - b);
  const out = [];
  for (const t of ts) {
    if (out.length && t - out[out.length - 1][0] < 1e-4) continue;
    out.push([t, roofAt(planes, p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t)]);
  }
  // Drop breakpoints that do not bend the line.
  return out.filter(
    (v, i) =>
      i === 0 ||
      i === out.length - 1 ||
      Math.abs(
        v[1] -
          (out[i - 1][1] +
            ((out[i + 1][1] - out[i - 1][1]) * (v[0] - out[i - 1][0])) / (out[i + 1][0] - out[i - 1][0])),
      ) > 0.01,
  );
}

/**
 * Add one building to the wall, roof and trim meshes. `party(edgeIndex, ring)` says whether a
 * wall is shared with a neighbour, which gets no windows or trim. Returns the style used.
 */
export function addBuilding(b, layers, spec, party) {
  const style = buildingStyle(b, spec);
  const { walls, trim } = layers;
  const r = style.r;
  const ring = simplifyRing(b.ring);
  const holes = b.holes.map((h) => simplifyRing(h)).filter((h) => h.length >= 3);
  if (ring.length < 3) return style;
  const base = b.minHeight;
  const box = orientedBox(ring);
  let shape = b.roofShape;
  // Turn the ridge when the map says which way the roof faces or that it runs across.
  if (shape !== 'flat' && b.roofDirection !== undefined) {
    const a = (b.roofDirection * Math.PI) / 180;
    const fx = Math.sin(a),
      fy = Math.cos(a);
    if (Math.abs(fx * box.lx + fy * box.ly) > 0.72) {
      [box.lx, box.ly, box.sx, box.sy, box.hl, box.hs] = [box.sx, box.sy, -box.lx, -box.ly, box.hs, box.hl];
    }
    if (shape === 'skillion' && fx * box.sx + fy * box.sy > 0) {
      box.sx = -box.sx;
      box.sy = -box.sy;
    }
  } else if (shape !== 'flat' && b.roofAcross) {
    [box.lx, box.ly, box.sx, box.sy, box.hl, box.hs] = [box.sx, box.sy, -box.lx, -box.ly, box.hs, box.hl];
  }
  // Split the total height into wall and roof.
  let rise = 0,
    top = b.height;
  if (shape !== 'flat') {
    const pitch =
      ((b.kind === 'religious' ? 52 : b.kind === 'residential' ? 40 + r(21) * 10 : 28 + r(21) * 10) * Math.PI) / 180;
    const span = shape === 'skillion' ? box.hs * 0.5 : box.hs;
    rise = b.roofHeight ?? clamp(span * Math.tan(pitch), 0.9, 8);
    if (b.inferred.includes('height') && b.roofHeight === undefined) top = b.height + rise;
    rise = Math.min(rise, (top - base) * 0.62);
    if (rise < 0.5) {
      shape = 'flat';
      rise = 0;
    }
  }
  const eave = top - rise;
  const wallHeight = eave - base;
  const planes = shape === 'flat' ? null : roofPlanes(shape, box, rise);
  // Floors: the ground floor is taller for shops, and the rest share what is left.
  const groundHeight = Math.min(
    wallHeight,
    style.ground === 1 ? 4.0 : style.ground === 2 ? Math.min(4.6, wallHeight) : 3.2,
  );
  let floors = Math.max(1, Math.min(b.levels, 200));
  let floorHeight = floors > 1 ? (wallHeight - groundHeight) / (floors - 1) : 3;
  if (floorHeight < 2.5 || floorHeight > 4.6) {
    floors = Math.max(1, Math.round((wallHeight - groundHeight) / 3.1) + 1);
    floorHeight = floors > 1 ? (wallHeight - groundHeight) / (floors - 1) : 3;
  }
  const wallColor = rgb(style.wall),
    trimColor = rgb(style.trim);

  // ------------------------------------------------------------------------ walls
  const emitRing = (pts, isHole) => {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i],
        q = pts[(i + 1) % n];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len < 0.05) continue;
      const dx = (q.x - p.x) / len,
        dy = (q.y - p.y) / len;
      const shared = !isHole && party(p, q);
      const lay = shared || len < 2.1 ? { margin: 0, count: 0, width: 0 } : bayLayout(len, style.bay);
      const doorBay = lay.count ? Math.floor(r(30 + (i % 40)) * lay.count) : 0;
      walls.frame(p.x, base, -p.y, [dx, 0, -dy], [0, 1, 0], [dy, 0, dx]);
      walls.extra(
        0,
        0,
        len,
        wallHeight,
        lay.width,
        floorHeight,
        groundHeight,
        lay.margin,
        style.material,
        lay.count ? style.window : 5,
        style.ground + (style.shutters ? 4 : 0) + 8 * doorBay,
        style.seed,
      );
      const prof = planes
        ? profile(planes, p, q)
        : [
            [0, 0],
            [1, 0],
          ];
      for (let k = 0; k + 1 < prof.length; k++) {
        const s0 = prof[k][0] * len,
          s1 = prof[k + 1][0] * len,
          h0 = wallHeight + Math.max(0, prof[k][1]),
          h1 = wallHeight + Math.max(0, prof[k + 1][1]);
        const corner = (s, h) => {
          walls.setExtra(0, s).setExtra(1, h);
          return walls.vertex(s, h, 0, 0, 0, 1, wallColor);
        };
        const a = corner(s0, 0),
          c = corner(s1, 0),
          d = corner(s1, h1),
          e = corner(s0, h0);
        walls.tri(a, c, d);
        walls.tri(a, d, e);
      }
      if (shared || !lay.count || isHole) continue;
      wallParts(
        trim,
        layers.fine ? layers.fine(p.x, p.y) : trim,
        [p.x, base, -p.y],
        [dx, 0, -dy],
        [dy, 0, dx],
        b,
        style,
        { len, lay, doorBay, floors, floorHeight, groundHeight, wallHeight, index: i, trimColor },
        spec,
      );
    }
  };
  emitRing(ring, false);
  for (const h of holes) emitRing(h, true);

  // ------------------------------------------------------------------- bands of trim
  const partyFlags = ring.map((p, i) => party(p, ring[(i + 1) % ring.length]));
  const band = (y0, y1, out, colour, rough = 0.8) => {
    const off = offsetRing(ring, out);
    if (!off) return;
    trim.reset().extra(rough, 0, 0, 0);
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      if (partyFlags[i]) continue;
      const j = (i + 1) % n;
      const a = ring[i],
        c = ring[j],
        ao = off[i],
        co = off[j];
      trim.quad([ao.x, y0, -ao.y], [co.x, y0, -co.y], [co.x, y1, -co.y], [ao.x, y1, -ao.y], colour);
      trim.quad([ao.x, y1, -ao.y], [co.x, y1, -co.y], [c.x, y1, -c.y], [a.x, y1, -a.y], colour, [0, 1, 0]);
      trim.quad([a.x, y0, -a.y], [c.x, y0, -c.y], [co.x, y0, -co.y], [ao.x, y0, -ao.y], shade(colour, 0.7), [0, -1, 0]);
      // Close the ends where the band stops at a shared wall.
      if (partyFlags[(i + n - 1) % n])
        trim.quad([a.x, y0, -a.y], [ao.x, y0, -ao.y], [ao.x, y1, -ao.y], [a.x, y1, -a.y], colour);
      if (partyFlags[j]) trim.quad([co.x, y0, -co.y], [c.x, y0, -c.y], [c.x, y1, -c.y], [co.x, y1, -co.y], colour);
    }
  };
  if (spec.detail !== 'massing' && wallHeight > 2.6 && b.area > 12) {
    if (style.plinth)
      band(
        base,
        base + 0.45 + r(22) * 0.3,
        0.05,
        shade(rgb(style.material === 1 ? style.wall : style.trim), style.material === 1 ? 0.62 : 0.6),
        0.9,
      );
    if (style.course && groundHeight < wallHeight - 1)
      band(base + groundHeight - 0.12, base + groundHeight + 0.1, 0.1, trimColor);
    if (style.cornice && shape === 'flat') {
      band(top - 0.62, top - 0.38, 0.14, trimColor);
      band(top - 0.38, top - 0.08, 0.3, trimColor);
    }
  }

  // ------------------------------------------------------------------------- roof
  const roofColor = rgb(style.roof);
  if (shape === 'flat')
    addFlatRoof(b, style, layers, { ring, holes, top, r, roofColor, wallColor, trimColor, box }, spec);
  else
    addPitchedRoof(
      b,
      style,
      layers,
      { ring, holes, eave, planes, r, roofColor, box, rise, shape, wallColor, partyFlags },
      spec,
    );
  return style;
}

function addFlatRoof(b, style, { roofs, trim }, o, spec) {
  const { ring, holes, top, r, roofColor, wallColor, trimColor } = o;
  const massing = spec.detail === 'massing';
  const parapet = massing || b.area < 20 ? 0 : b.kind === 'industrial' ? 0.25 : 0.45 + r(40) * 0.5;
  const inner = parapet ? offsetRing(ring, -0.28) : null;
  const deck = inner ? top - parapet : top;
  const { points, triangles } = triangulate(ring, holes);
  roofs.reset().extra(0, 0, style.roofMaterial, style.seed);
  const ids = points.map((p) => {
    roofs.setExtra(0, p.x).setExtra(1, p.y);
    return roofs.vertex(p.x, deck, -p.y, 0, 1, 0, roofColor);
  });
  for (let i = 0; i < triangles.length; i += 3)
    roofs.tri(ids[triangles[i]], ids[triangles[i + 1]], ids[triangles[i + 2]]);
  if (inner) {
    // The parapet: a cap on top of the wall and its inner face down to the deck.
    const cap = style.cornice || style.material === 1 ? trimColor : shade(wallColor, 0.9);
    trim.reset().extra(0.85, 0, 0, 0);
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ring[i],
        c = ring[j],
        ai = inner[i],
        ci = inner[j];
      trim.quad([a.x, top, -a.y], [c.x, top, -c.y], [ci.x, top, -ci.y], [ai.x, top, -ai.y], cap, [0, 1, 0]);
      trim.quad(
        [ci.x, deck, -ci.y],
        [ai.x, deck, -ai.y],
        [ai.x, top, -ai.y],
        [ci.x, top, -ci.y],
        shade(wallColor, 0.8),
      );
    }
  }
  if (massing || b.area < 60) return;
  // Roof plant: stair heads, air handlers, vents, skylights and, on a few, solar panels.
  const count = Math.min(14, Math.floor(b.area / 110) + (r(41) < 0.6 ? 1 : 0));
  const place = (k, clear) => {
    for (let t = 0; t < 8; t++) {
      const u = (r(50 + k * 9 + t) * 2 - 1) * (o.box.hl - clear),
        v = (r(51 + k * 9 + t) * 2 - 1) * (o.box.hs - clear);
      const x = o.box.cx + o.box.lx * u + o.box.sx * v,
        y = o.box.cy + o.box.ly * u + o.box.sy * v;
      if (!pointInRing(x, y, ring) || ringDistance(x, y, ring) < clear) continue;
      if (holes.some((h) => pointInRing(x, y, h) || ringDistance(x, y, h) < clear)) continue;
      return { x, y };
    }
    return null;
  };
  const turn = Math.atan2(-o.box.ly, o.box.lx);
  const metal = rgb(hsla(210, 5, 62)),
    dark = rgb(hsla(210, 6, 30));
  for (let k = 0; k < count; k++) {
    const kind = r(60 + k);
    const at = place(k, kind < 0.2 ? 2.4 : 1.6);
    if (!at) continue;
    trim.at(at.x, deck, -at.y, turn + (r(61 + k) < 0.5 ? 0 : Math.PI / 2));
    if (kind < 0.2) {
      // Stair or lift head.
      trim.extra(0.85, 0, 0, 0).box(-1.6, 0, -1.3, 1.6, 2.5 + r(62 + k) * 0.6, 1.3, shade(wallColor, 0.92));
      trim.extra(0.6, 0, 0, 0).box(-1.75, 2.5 + r(62 + k) * 0.6, -1.45, 1.75, 2.62 + r(62 + k) * 0.6, 1.45, dark);
    } else if (kind < 0.55) {
      // Air handler with a fan grille.
      const w = 0.8 + r(63 + k) * 0.7;
      trim.extra(0.45, 0, 0, 0).box(-w, 0.15, -0.55, w, 1.05, 0.55, metal);
      trim.extra(0.7, 0, 0, 0).box(-w - 0.05, 0, -0.45, w + 0.05, 0.15, 0.45, dark);
      trim.extra(0.5, 0, 0, 0).column(0, 0, 1.05, 1.12, 0.42, 0.42, dark, 10, 'top');
    } else if (kind < 0.75) {
      // Vent pipe with a cowl.
      trim.extra(0.4, 0, 0, 0).column(0, 0, 0, 0.9 + r(64 + k) * 0.6, 0.14, 0.14, metal, 8, '');
      trim.column(0, 0, 0.9 + r(64 + k) * 0.6, 1.1 + r(64 + k) * 0.6, 0.24, 0.1, metal, 8, 'top');
    } else if (kind < 0.9) {
      // Skylight: a low glazed box.
      trim.extra(0.6, 0, 0, 0).box(-1.1, 0, -0.75, 1.1, 0.28, 0.75, shade(wallColor, 0.8));
      trim.extra(0.08, 0, 0, 0).box(-1.0, 0.28, -0.65, 1.0, 0.36, 0.65, rgb(hsla(205, 30, 34)));
    } else {
      // A short row of solar panels, tilted to the south.
      trim.at(at.x, deck, -at.y, 0);
      const panels = 2 + Math.floor(r(65 + k) * 3);
      for (let p = 0; p < panels; p++) {
        const x0 = (p - panels / 2) * 1.75;
        trim
          .extra(0.12, 0, 0, 0)
          .quad(
            [x0, 0.12, 0.6],
            [x0 + 1.65, 0.12, 0.6],
            [x0 + 1.65, 0.62, -0.4],
            [x0, 0.62, -0.4],
            rgb(hsla(222, 40, 16)),
          );
        trim
          .extra(0.5, 0, 0, 0)
          .quad([x0 + 1.65, 0.0, -0.4], [x0, 0.0, -0.4], [x0, 0.62, -0.4], [x0 + 1.65, 0.62, -0.4], metal);
      }
    }
  }
}

function addPitchedRoof(b, style, { roofs, trim }, o, spec) {
  const { ring, holes, eave, planes, r, roofColor, box, rise, shape } = o;
  const massing = spec.detail === 'massing';
  const overhang = massing ? 0 : 0.28 + r(70) * 0.22;
  const outer = (overhang && !o.partyFlags.some(Boolean) && offsetRing(ring, overhang)) || ring;
  const { points, triangles } = triangulate(outer, holes);
  roofs.reset();
  for (let i = 0; i < planes.length; i++) {
    const pl = planes[i];
    const g = Math.hypot(pl[0], pl[1]);
    if (g < 1e-6) continue;
    const slope = Math.sqrt(1 + g * g);
    // Along the eave (u) and up the slope (v), in metres, so tile courses run level.
    const ux = -pl[1] / g,
      uy = pl[0] / g;
    const nrm = [-pl[0] / slope, 1 / slope, pl[1] / slope];
    for (let t = 0; t < triangles.length; t += 3) {
      let poly = [0, 1, 2].map((k) => {
        const p = points[triangles[t + k]];
        return [p.x, p.y];
      });
      for (let j = 0; j < planes.length && poly.length >= 3; j++) {
        if (j === i) continue;
        const values = poly.map((p) => planeAt(pl, p[0], p[1]) - planeAt(planes[j], p[0], p[1]) - (j < i ? 0 : 1e-9));
        poly = clipConvex(poly, values);
      }
      if (poly.length < 3) continue;
      const first = roofs.vertexCount;
      for (const p of poly) {
        const h = planeAt(pl, p[0], p[1]);
        roofs.extra(p[0] * ux + p[1] * uy, (h / g) * slope, style.roofMaterial, style.seed);
        roofs.vertex(p[0], eave + h, -p[1], nrm[0], nrm[1], nrm[2], roofColor);
      }
      for (let k = 1; k + 1 < poly.length; k++) roofs.tri(first, first + k, first + k + 1);
    }
  }
  if (massing) return;
  // Fascia: a board under the edge of the roof, following gables up to the ridge.
  const fascia = shade(rgb(style.trim), 0.92);
  trim.reset().extra(0.7, 0, 0, 0);
  const n = outer.length;
  if (outer !== ring)
    for (let i = 0; i < n; i++) {
      const p = outer[i],
        q = outer[(i + 1) % n];
      const prof = profile(planes, p, q);
      for (let k = 0; k + 1 < prof.length; k++) {
        const ax = p.x + (q.x - p.x) * prof[k][0],
          ay = p.y + (q.y - p.y) * prof[k][0],
          cx = p.x + (q.x - p.x) * prof[k + 1][0],
          cy = p.y + (q.y - p.y) * prof[k + 1][0];
        const h0 = eave + prof[k][1],
          h1 = eave + prof[k + 1][1];
        trim.quad([ax, h0 - 0.2, -ay], [cx, h1 - 0.2, -cy], [cx, h1 + 0.02, -cy], [ax, h0 + 0.02, -ay], fascia);
      }
    }
  // Chimneys near the ridge of houses.
  if ((b.kind === 'residential' || b.kind === 'apartment') && shape !== 'skillion' && box.hs > 2.2) {
    const want = r(71) * style.chimneys;
    const count = want < 0.2 ? 0 : want < 0.85 ? 1 : 2;
    const brick = rgb(hsla(14 + r(72) * 10, 36, 30 + r(73) * 10)),
      pot = rgb(hsla(18, 46, 44));
    for (let k = 0; k < count; k++) {
      const al = (r(74 + k) < 0.5 ? -1 : 1) * (0.2 + r(76 + k) * 0.55) * Math.max(0, box.hl - 1.2),
        ac = (r(78 + k) < 0.5 ? -1 : 1) * (0.1 + r(80 + k) * 0.25) * box.hs;
      const x = box.cx + box.lx * al + box.sx * ac,
        y = box.cy + box.ly * al + box.sy * ac;
      if (!pointInRing(x, y, ring) || ringDistance(x, y, ring) < 0.8) continue;
      const foot = eave + roofAt(planes, x, y) - 0.3,
        head = eave + rise + 0.5 + r(82 + k) * 0.5;
      trim.at(x, foot, -y, Math.atan2(-box.ly, box.lx));
      trim.extra(0.9, 0, 0, 0).box(-0.42, 0, -0.3, 0.42, head - foot, 0.3, brick);
      trim.box(-0.48, head - foot, -0.36, 0.48, head - foot + 0.1, 0.36, shade(brick, 0.7));
      trim.column(-0.18, 0, head - foot + 0.1, head - foot + 0.45, 0.11, 0.09, pot, 7, '');
      if (r(84 + k) < 0.5) trim.column(0.18, 0, head - foot + 0.1, head - foot + 0.4, 0.11, 0.09, pot, 7, '');
    }
  }
}

// Parts that stand proud of one wall: balconies, awnings, shop signs and steps. The frame has
// its origin at the wall's first corner at the base, x along the wall, y up and z outward.
function wallParts(trim, fine, origin, along, out, b, style, w, spec) {
  if (spec.detail === 'massing' || !w.lay.count) return;
  const r = (k) => style.r(100 + w.index * 31 + k);
  const { lay, floors, floorHeight, groundHeight, wallHeight, trimColor } = w;
  trim.frame(origin[0], origin[1], origin[2], along, [0, 1, 0], out);
  // Railings and other small parts go to the fine layer, which a renderer may drop far away.
  if (fine !== trim) fine.frame(origin[0], origin[1], origin[2], along, [0, 1, 0], out);
  const bayX = (i) => lay.margin + (i + 0.5) * lay.width;
  // Balconies on the upper floors.
  if (style.balcony && floors >= 2 && lay.width >= 1.9) {
    const depth = 0.9 + r(1) * 0.4;
    const width = Math.min(lay.width * 0.84, 3.4);
    const glass = style.recent;
    const rail = glass ? rgb(hsla(200, 18, 36)) : rgb(hsla(0, 0, 14 + r(2) * 10));
    const slab = style.recent ? rgb(hsla(40, 4, 82)) : trimColor;
    for (let i = 0; i < lay.count; i++) {
      if (style.balcony === 2 && (i + Math.floor(style.seed * 2)) % 2) continue;
      if (style.balcony === 3 && i !== Math.floor(lay.count / 2)) continue;
      for (let f = 1; f < floors; f++) {
        if (style.r(400 + w.index * 7 + i * 3 + f) < 0.06) continue;
        const y = groundHeight + (f - 1) * floorHeight;
        if (y + 1.2 > wallHeight) continue;
        const x0 = bayX(i) - width / 2,
          x1 = bayX(i) + width / 2;
        trim.extra(0.8, 0, 0, 0).box(x0, y - 0.14, 0, x1, y + 0.02, depth, slab, 'z0');
        if (glass) {
          fine.extra(0.08, 0, 6, 0).box(x0 + 0.03, y + 0.02, depth - 0.05, x1 - 0.03, y + 1.0, depth - 0.02, rail);
          fine.box(x0 + 0.02, y + 0.02, 0.05, x0 + 0.05, y + 1.0, depth - 0.02, rail);
          fine.box(x1 - 0.05, y + 0.02, 0.05, x1 - 0.02, y + 1.0, depth - 0.02, rail);
          fine.extra(0.4, 0, 0, 0).box(x0, y + 1.0, depth - 0.07, x1, y + 1.05, depth, rgb(hsla(210, 5, 40)));
          fine.extra(0.08, 0, 6, 0);
        } else {
          // Iron railing: a top rail, a bottom rail and upright bars.
          fine.extra(0.5, 0, 0, 0);
          fine.box(x0, y + 0.98, depth - 0.05, x1, y + 1.04, depth, rail);
          fine.box(x0, y + 0.98, 0, x0 + 0.05, y + 1.04, depth, rail);
          fine.box(x1 - 0.05, y + 0.98, 0, x1, y + 1.04, depth, rail);
          const bars = Math.max(4, Math.round(width / 0.16));
          for (let k = 0; k <= bars; k++) {
            const x = x0 + ((x1 - x0 - 0.03) * k) / bars;
            fine.box(x, y + 0.02, depth - 0.04, x + 0.03, y + 0.98, depth - 0.01, rail, 'y0y1');
          }
          for (const x of [x0, x1 - 0.03])
            for (let k = 1; k < 5; k++)
              fine.box(x, y + 0.02, (depth * k) / 5 - 0.015, x + 0.03, y + 0.98, (depth * k) / 5 + 0.015, rail, 'y0y1');
        }
      }
    }
  }
  // Shop units: each unit spans one to three bays and has its own sign and awning.
  if (style.ground === 1 && groundHeight >= 3) {
    let i = 0,
      unit = 0;
    while (i < lay.count) {
      const span = Math.min(lay.count - i, 1 + Math.floor(r(10 + unit) * 2.6));
      const x0 = lay.margin + i * lay.width + 0.12,
        x1 = lay.margin + (i + span) * lay.width - 0.12;
      const sign = SIGNS[Math.floor(r(20 + unit) * SIGNS.length)];
      const signColor = rgb(hsla(sign[0], sign[1], sign[2]));
      // The sign board glows after dark (glow kind 2).
      trim.extra(0.55, 0.9, 2, 0).box(x0, groundHeight * 0.8, 0, x1, groundHeight * 0.955, 0.09, signColor, 'z0');
      // A lighter name plate on the board, off-centre, so boards do not read as plain bars.
      const plate = sign[2] > 50 ? shade(signColor, 0.35) : rgb(hsla(sign[0], Math.max(0, sign[1] - 20), 88));
      const pw = (x1 - x0) * (0.3 + r(30 + unit) * 0.3),
        px = x0 + (x1 - x0 - pw) * (0.2 + r(40 + unit) * 0.6);
      trim.extra(0.5, 1.4, 2, 0).box(px, groundHeight * 0.835, 0.09, px + pw, groundHeight * 0.92, 0.1, plate, 'z0');
      if (r(50 + unit) < style.awnings) {
        const a = AWNINGS[Math.floor(r(60 + unit) * AWNINGS.length)];
        const cloth = rgb(hsla(a[0], a[1], a[2])),
          pale = rgb(hsla(a[0], a[1] * 0.3, 88));
        const reach = 1.0 + r(70 + unit) * 0.6,
          yTop = groundHeight * 0.79,
          yLow = yTop - reach * 0.36;
        // Striped cloth: alternate bands along the wall.
        const striped = r(80 + unit) < 0.4;
        const bands = striped ? Math.max(2, Math.round((x1 - x0) / 0.45)) : 1;
        trim.extra(0.9, 0, 0, 0);
        for (let k = 0; k < bands; k++) {
          const a0 = x0 + ((x1 - x0) * k) / bands,
            a1 = x0 + ((x1 - x0) * (k + 1)) / bands,
            c = striped && k % 2 ? pale : cloth;
          trim.quad([a0, yLow, reach], [a1, yLow, reach], [a1, yTop, 0.02], [a0, yTop, 0.02], c);
          trim.quad([a0, yLow - 0.2, reach], [a1, yLow - 0.2, reach], [a1, yLow, reach], [a0, yLow, reach], c);
        }
        trim.poly(
          [
            [x0, yLow, reach],
            [x0, yTop, 0.02],
            [x0, yLow, 0.02],
          ],
          shade(cloth, 0.8),
        );
        trim.poly(
          [
            [x1, yLow, 0.02],
            [x1, yTop, 0.02],
            [x1, yLow, reach],
          ],
          shade(cloth, 0.8),
        );
        // Underside, seen from the pavement.
        trim.quad([x0, yTop, 0.02], [x1, yTop, 0.02], [x1, yLow, reach], [x0, yLow, reach], shade(cloth, 0.55));
      }
      i += span;
      unit++;
    }
  }
  // A step and a canopy at the front door of homes.
  if (style.ground === 0 && b.kind !== 'industrial' && w.len > 3 && lay.width > 1.2) {
    const x = bayX(w.doorBay);
    const stone = rgb(hsla(36, 8, 62));
    trim.extra(0.9, 0, 0, 0).box(x - 0.75, 0, 0, x + 0.75, 0.16, 0.5, stone, 'z0y0');
    if (r(90) < 0.35) trim.box(x - 0.6, 0.16, 0, x + 0.6, 0.3, 0.28, stone, 'z0y0');
    if (style.recent && r(91) < 0.6)
      trim.extra(0.5, 0, 0, 0).box(x - 0.9, 2.45, 0, x + 0.9, 2.53, 0.8, rgb(hsla(210, 5, 34)), 'z0');
    // A wall lamp by some doors (glow kind 1: on with the street lamps).
    if (r(92) < 0.3) {
      fine.extra(0.5, 0, 0, 0).box(x + 0.82, 2.0, 0, x + 0.9, 2.2, 0.12, rgb(hsla(0, 0, 16)), 'z0');
      fine.extra(0.4, 2.2, 1, 0).box(x + 0.8, 1.86, 0.04, x + 0.92, 2.0, 0.16, rgb(hsla(44, 70, 80)));
    }
  }
  // Roller doors of workshops carry a kerb-high threshold so the gate reads as an opening.
  if (style.ground === 2 && lay.width > 2.4) {
    const x = bayX(w.doorBay);
    trim
      .extra(0.9, 0, 0, 0)
      .box(x - lay.width * 0.4, 0, 0, x + lay.width * 0.4, 0.05, 0.3, rgb(hsla(40, 4, 46)), 'z0y0');
  }
}
