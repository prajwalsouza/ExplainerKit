import { assert } from '../../core/validate.js';
import { toRGBA } from '../../color/space.js';

// Geometry tools for the city kit: a growable triangle-mesh builder with per-vertex colour and
// a few extra numbers per vertex, a polygon triangulator, ring helpers and solid primitives.
// Coordinates are metres with x east, y up and z south, so a ring that runs counter-clockwise
// on the map (x east, y north) faces up after `north` becomes `-z`.

export const MAX_VERTICES = 6_000_000;

/** sRGB components 0..1 of a library colour, cached because palettes repeat. */
const rgbCache = new Map();
export function rgb(color) {
  if (Array.isArray(color)) return color;
  let c = rgbCache.get(color);
  if (!c) {
    c = Object.freeze(toRGBA(color).slice(0, 3));
    if (rgbCache.size < 4096) rgbCache.set(color, c);
  }
  return c;
}
export const shade = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
export const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * A growable mesh. `extra` is how many extra numbers each vertex carries (0, 4, 8 or 12); the
 * finished mesh returns them as `extra` with that stride. A frame maps local coordinates to the
 * world, so parts can be modelled around an origin and placed along a wall or at a position.
 */
export function meshBuilder(extra = 0, budget = { vertices: 0 }, elevation) {
  let cap = 4096,
    count = 0,
    icap = 8192,
    icount = 0;
  let pos = new Float32Array(cap * 3),
    nor = new Float32Array(cap * 3),
    col = new Float32Array(cap * 3),
    ext = new Float32Array(cap * extra),
    idx = new Uint32Array(icap);
  // Frame: origin o and an orthonormal right-handed basis (ux, uy, uz).
  let f = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
  let e = new Float32Array(extra);
  const grow = () => {
    cap *= 2;
    const g = (a, n) => {
      const b = new Float32Array(cap * n);
      b.set(a);
      return b;
    };
    pos = g(pos, 3);
    nor = g(nor, 3);
    col = g(col, 3);
    ext = g(ext, extra);
  };
  const api = {
    get vertexCount() {
      return count;
    },
    get triangleCount() {
      return icount / 3;
    },
    /** Place following geometry at `origin` with local x along `ux` and local y along `uy`. */
    frame(ox, oy, oz, ux, uy, uz) {
      f = [ox, oy, oz, ...ux, ...uy, ...uz];
      return api;
    },
    /** Place following geometry at a point, turned by `turn` radians about the vertical axis. */
    at(x, y, z, turn = 0, scale = 1) {
      const c = Math.cos(turn) * scale,
        s = Math.sin(turn) * scale;
      f = [x, y, z, c, 0, -s, 0, scale, 0, s, 0, c];
      return api;
    },
    reset() {
      f = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
      return api;
    },
    /** Set the extra numbers written with following vertices. */
    extra(...values) {
      for (let i = 0; i < extra; i++) e[i] = values[i] ?? 0;
      return api;
    },
    setExtra(i, v) {
      e[i] = v;
      return api;
    },
    /** One vertex from local position and local normal. Returns its index. */
    vertex(x, y, z, nx, ny, nz, c) {
      if (count === cap) grow();
      budget.vertices++;
      assert(
        budget.vertices <= MAX_VERTICES,
        'RESOURCE_LIMIT',
        `A city model holds at most ${MAX_VERTICES} vertices. Use a smaller area or less detail.`,
      );
      const k = count * 3;
      pos[k] = f[0] + x * f[3] + y * f[6] + z * f[9];
      pos[k + 1] = f[1] + x * f[4] + y * f[7] + z * f[10];
      pos[k + 2] = f[2] + x * f[5] + y * f[8] + z * f[11];
      if (elevation) pos[k + 1] += elevation(pos[k], pos[k + 2]);
      // Frames may scale uniformly, so normals are renormalised.
      let wx = nx * f[3] + ny * f[6] + nz * f[9],
        wy = nx * f[4] + ny * f[7] + nz * f[10],
        wz = nx * f[5] + ny * f[8] + nz * f[11];
      let l = Math.hypot(wx, wy, wz);
      // A face with no area has no direction. Give it one, so no vertex carries a zero normal.
      if (!(l > 1e-9)) {
        wx = 0;
        wy = 1;
        wz = 0;
        l = 1;
      }
      nor[k] = wx / l;
      nor[k + 1] = wy / l;
      nor[k + 2] = wz / l;
      col[k] = c[0];
      col[k + 1] = c[1];
      col[k + 2] = c[2];
      if (extra) ext.set(e, count * extra);
      return count++;
    },
    tri(a, b, c) {
      if (icount + 3 > icap) {
        icap *= 2;
        const n = new Uint32Array(icap);
        n.set(idx);
        idx = n;
      }
      idx[icount++] = a;
      idx[icount++] = b;
      idx[icount++] = c;
    },
    /** A flat polygon from local points given counter-clockwise as seen from its front. */
    poly(points, c, normal) {
      const n = normal ?? faceNormal(points);
      const first = count;
      for (const p of points) api.vertex(p[0], p[1], p[2], n[0], n[1], n[2], c);
      for (let i = 1; i + 1 < points.length; i++) api.tri(first, first + i, first + i + 1);
      return first;
    },
    quad(a, b, c2, d, c, normal) {
      return api.poly([a, b, c2, d], c, normal);
    },
    /** An axis-aligned box in the local frame. `skip` lists faces to leave out: x0 x1 y0 y1 z0 z1. */
    box(x0, y0, z0, x1, y1, z1, c, skip = '') {
      const top = c.top ?? c,
        side = c.side ?? c;
      if (!skip.includes('y1')) api.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top, [0, 1, 0]);
      if (!skip.includes('y0')) api.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], side, [0, -1, 0]);
      if (!skip.includes('z1')) api.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side, [0, 0, 1]);
      if (!skip.includes('z0')) api.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, [0, 0, -1]);
      if (!skip.includes('x1')) api.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, [1, 0, 0]);
      if (!skip.includes('x0')) api.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, [-1, 0, 0]);
      return api;
    },
    /**
     * A round or many-sided column along local y from (r0 at y0) to (r1 at y1), with smooth
     * side normals. `caps` is '', 'top', 'bottom' or 'both'.
     */
    column(cx, cz, y0, y1, r0, r1, c, sides = 8, caps = 'top', turn = 0) {
      const slope = (r0 - r1) / Math.max(1e-6, y1 - y0);
      const first = count;
      for (let i = 0; i <= sides; i++) {
        const a = turn + (i / sides) * Math.PI * 2,
          ca = Math.cos(a),
          sa = Math.sin(a);
        api.vertex(cx + ca * r0, y0, cz + sa * r0, ca, slope, sa, c);
        api.vertex(cx + ca * r1, y1, cz + sa * r1, ca, slope, sa, c);
      }
      for (let i = 0; i < sides; i++) {
        const k = first + i * 2;
        api.tri(k, k + 1, k + 3);
        api.tri(k, k + 3, k + 2);
      }
      const endCap = (y, r, up) => {
        if (r < 1e-4) return;
        const pts = [];
        for (let i = 0; i < sides; i++) {
          const a = turn + ((up ? sides - i : i) / sides) * Math.PI * 2;
          pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
        }
        api.poly(pts, c, [0, up ? 1 : -1, 0]);
      };
      if (caps === 'top' || caps === 'both') endCap(y1, r1, true);
      if (caps === 'bottom' || caps === 'both') endCap(y0, r0, false);
      return api;
    },
    /** A tube of radius r (number or one per point) along local points, for arms, rails and wires. */
    tube(points, r, c, sides = 6, caps = true) {
      const n = points.length;
      if (n < 2) return api;
      const first = count;
      // A frame carried along the path so the tube does not twist.
      let up = [0, 1, 0];
      for (let i = 0; i < n; i++) {
        const a = points[Math.max(0, i - 1)],
          b = points[Math.min(n - 1, i + 1)];
        const t = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        if (Math.abs(dot3(t, up)) > 0.95) up = Math.abs(t[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
        const side = norm3(cross3(t, up));
        up = norm3(cross3(side, t));
        const rad = typeof r === 'number' ? r : r[i];
        for (let s = 0; s <= sides; s++) {
          const ang = (s / sides) * Math.PI * 2,
            ca = Math.cos(ang),
            sa = Math.sin(ang);
          const nx = side[0] * ca + up[0] * sa,
            ny = side[1] * ca + up[1] * sa,
            nz = side[2] * ca + up[2] * sa;
          api.vertex(points[i][0] + nx * rad, points[i][1] + ny * rad, points[i][2] + nz * rad, nx, ny, nz, c);
        }
      }
      const ring = sides + 1;
      for (let i = 0; i + 1 < n; i++)
        for (let s = 0; s < sides; s++) {
          const k = first + i * ring + s;
          api.tri(k, k + ring + 1, k + ring);
          api.tri(k, k + 1, k + ring + 1);
        }
      if (caps) {
        for (const end of [0, n - 1]) {
          const p = points[end],
            q = points[end === 0 ? 1 : n - 2];
          const dir = norm3([p[0] - q[0], p[1] - q[1], p[2] - q[2]]);
          const centre = api.vertex(p[0], p[1], p[2], dir[0], dir[1], dir[2], c);
          for (let s = 0; s < sides; s++) {
            const k = first + end * ring + s;
            if (end === 0) api.tri(centre, k + 1, k);
            else api.tri(centre, k, k + 1);
          }
        }
      }
      return api;
    },
    /**
     * A rounded lump: a subdivided icosahedron scaled to (rx, ry, rz) and pushed in and out by
     * `bump(x, y, z)` (a value near 1). `colour(nx, ny, nz)` may vary the colour over it.
     */
    blob(cx, cy, cz, rx, ry, rz, c, detail = 1, bump = null, colour = null) {
      const { points, faces } = icosphere(detail);
      const first = count;
      const moved = points.map((p) => {
        const k = bump ? bump(p[0], p[1], p[2]) : 1;
        return [cx + p[0] * rx * k, cy + p[1] * ry * k, cz + p[2] * rz * k];
      });
      // Smooth normals from the displaced faces.
      const normals = points.map(() => [0, 0, 0]);
      for (const [a, b, c3] of faces) {
        const n = faceNormal([moved[a], moved[b], moved[c3]], false);
        for (const i of [a, b, c3]) {
          normals[i][0] += n[0];
          normals[i][1] += n[1];
          normals[i][2] += n[2];
        }
      }
      for (let i = 0; i < points.length; i++) {
        const n = norm3(normals[i]);
        api.vertex(
          moved[i][0],
          moved[i][1],
          moved[i][2],
          n[0],
          n[1],
          n[2],
          colour ? colour(points[i][0], points[i][1], points[i][2]) : c,
        );
      }
      for (const [a, b, c3] of faces) api.tri(first + a, first + b, first + c3);
      return api;
    },
    /** A surface of revolution about local y from a profile of [radius, y] pairs, bottom to top. */
    lathe(cx, cz, profile, c, sides = 10) {
      const first = count;
      for (let j = 0; j < profile.length; j++) {
        const a = profile[Math.max(0, j - 1)],
          b = profile[Math.min(profile.length - 1, j + 1)];
        const dr = b[0] - a[0],
          dy = b[1] - a[1],
          l = Math.hypot(dr, dy) || 1;
        for (let i = 0; i <= sides; i++) {
          const ang = (i / sides) * Math.PI * 2,
            ca = Math.cos(ang),
            sa = Math.sin(ang);
          api.vertex(
            cx + ca * profile[j][0],
            profile[j][1],
            cz + sa * profile[j][0],
            (ca * dy) / l,
            -dr / l,
            (sa * dy) / l,
            c,
          );
        }
      }
      const ring = sides + 1;
      for (let j = 0; j + 1 < profile.length; j++)
        for (let i = 0; i < sides; i++) {
          const k = first + j * ring + i;
          api.tri(k, k + ring, k + ring + 1);
          api.tri(k, k + ring + 1, k + 1);
        }
      return api;
    },
    /** Append a finished mesh through the current frame, optionally tinted. */
    append(mesh, tint = null) {
      const first = count,
        p = mesh.positions,
        n = mesh.normals,
        c = mesh.colors,
        stride = mesh.extraStride ?? 0;
      for (let i = 0; i < mesh.vertexCount; i++) {
        if (extra && stride === extra) for (let j = 0; j < extra; j++) e[j] = mesh.extra[i * stride + j];
        const k = i * 3;
        const colour = tint ? [c[k] * tint[0], c[k + 1] * tint[1], c[k + 2] * tint[2]] : [c[k], c[k + 1], c[k + 2]];
        api.vertex(p[k], p[k + 1], p[k + 2], n[k], n[k + 1], n[k + 2], colour);
      }
      for (let i = 0; i < mesh.indices.length; i += 3)
        api.tri(first + mesh.indices[i], first + mesh.indices[i + 1], first + mesh.indices[i + 2]);
      return api;
    },
    finish() {
      return {
        positions: pos.slice(0, count * 3),
        normals: nor.slice(0, count * 3),
        colors: col.slice(0, count * 3),
        extra: ext.slice(0, count * extra),
        extraStride: extra,
        indices: idx.slice(0, icount),
        vertexCount: count,
        triangleCount: icount / 3,
      };
    },
  };
  return api;
}

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function faceNormal(p, unit = true) {
  // Newell's method, which stays stable for polygons with more than three points.
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit ? norm3([x, y, z]) : [x, y, z];
}

const spheres = new Map();
function icosphere(detail) {
  let s = spheres.get(detail);
  if (s) return s;
  const t = (1 + Math.sqrt(5)) / 2;
  let points = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map(norm3);
  let faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let d = 0; d < Math.min(3, detail); d++) {
    const mid = new Map(),
      next = [];
    const middle = (a, b) => {
      const key = a < b ? a * 100000 + b : b * 100000 + a;
      let m = mid.get(key);
      if (m === undefined) {
        m = points.length;
        points.push(norm3([points[a][0] + points[b][0], points[a][1] + points[b][1], points[a][2] + points[b][2]]));
        mid.set(key, m);
      }
      return m;
    };
    for (const [a, b, c] of faces) {
      const ab = middle(a, b),
        bc = middle(b, c),
        ca = middle(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  s = { points, faces };
  spheres.set(detail, s);
  return s;
}

// ------------------------------------------------------------------------------- rings

/** Signed area of a ring of {x, y} points: positive when counter-clockwise. */
export function ringArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i],
      q = ring[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Distance from a point to the nearest edge of a ring. */
export function ringDistance(x, y, ring) {
  let best = Infinity;
  for (let i = 0, n = ring.length; i < n; i++) best = Math.min(best, segmentDistance(x, y, ring[i], ring[(i + 1) % n]));
  return best;
}
export function segmentDistance(x, y, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / l2)) : 0;
  return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
}
/** Drop points that lie on a straight run, so a wall is one face rather than many slivers. */
export function simplifyRing(ring, tolerance = 0.06) {
  let pts = ring.slice();
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > 3; i++) {
      const a = pts[(i + pts.length - 1) % pts.length],
        b = pts[i],
        c = pts[(i + 1) % pts.length];
      const l = Math.hypot(c.x - a.x, c.y - a.y);
      const off = l < 1e-6 ? 0 : Math.abs((c.x - a.x) * (a.y - b.y) - (a.x - b.x) * (c.y - a.y)) / l;
      const short = Math.hypot(b.x - a.x, b.y - a.y) < 0.12;
      if (off < tolerance || short) {
        pts.splice(i, 1);
        changed = true;
        i--;
      }
    }
  }
  return pts;
}
/**
 * Move a ring outward by `d` metres (inward when negative), joining edges at mitres. Returns
 * null when the result folds over itself, which the caller treats as "no offset possible".
 */
export function offsetRing(ring, d, limit = 3) {
  const n = ring.length,
    sign = ringArea(ring) >= 0 ? 1 : -1,
    out = [];
  for (let i = 0; i < n; i++) {
    const a = ring[(i + n - 1) % n],
      b = ring[i],
      c = ring[(i + 1) % n];
    let ux = b.x - a.x,
      uy = b.y - a.y,
      vx = c.x - b.x,
      vy = c.y - b.y;
    const lu = Math.hypot(ux, uy) || 1,
      lv = Math.hypot(vx, vy) || 1;
    ux /= lu;
    uy /= lu;
    vx /= lv;
    vy /= lv;
    // Outward normals of the two edges of a counter-clockwise ring.
    const n1x = uy * sign,
      n1y = -ux * sign,
      n2x = vy * sign,
      n2y = -vx * sign;
    let mx = n1x + n2x,
      my = n1y + n2y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) {
      mx = n1x;
      my = n1y;
    } else {
      const k = Math.min(limit, 1 / Math.max(1e-3, (mx * n1x + my * n1y) / ml)) / ml;
      mx *= k;
      my *= k;
    }
    out.push({ x: b.x + mx * d, y: b.y + my * d });
  }
  if (d < 0) {
    const a0 = ringArea(ring),
      a1 = ringArea(out);
    if (a0 * a1 <= 0 || Math.abs(a1) > Math.abs(a0)) return null;
    // An inward offset that crosses itself has edges pointing the other way.
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if ((ring[j].x - ring[i].x) * (out[j].x - out[i].x) + (ring[j].y - ring[i].y) * (out[j].y - out[i].y) < 0)
        return null;
    }
  }
  return out;
}
/** The smallest rectangle around a ring: centre, unit axes (long and short) and half sizes. */
export function orientedBox(ring) {
  let best = null;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 0.3) continue;
    const ux = (b.x - a.x) / l,
      uy = (b.y - a.y) / l;
    let u0 = Infinity,
      u1 = -Infinity,
      v0 = Infinity,
      v1 = -Infinity;
    for (const p of ring) {
      const u = p.x * ux + p.y * uy,
        v = -p.x * uy + p.y * ux;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area - 1e-6) best = { area, ux, uy, u0, u1, v0, v1 };
  }
  if (!best) best = { area: 0, ux: 1, uy: 0, u0: 0, u1: 0.1, v0: 0, v1: 0.1 };
  const cu = (best.u0 + best.u1) / 2,
    cv = (best.v0 + best.v1) / 2;
  let hl = (best.u1 - best.u0) / 2,
    hs = (best.v1 - best.v0) / 2;
  let lx = best.ux,
    ly = best.uy,
    sx = -best.uy,
    sy = best.ux;
  if (hs > hl) {
    [hl, hs] = [hs, hl];
    [lx, ly, sx, sy] = [sx, sy, -lx, -ly];
  }
  return { cx: cu * best.ux - cv * best.uy, cy: cu * best.uy + cv * best.ux, lx, ly, sx, sy, hl, hs };
}

// ---------------------------------------------------------------------- triangulation

const cross2 = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function segmentsCross(a, b, c, d) {
  const d1 = cross2(c, d, a),
    d2 = cross2(c, d, b),
    d3 = cross2(a, b, c),
    d4 = cross2(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
/**
 * Triangulate a polygon with holes by ear clipping. `ring` is counter-clockwise, holes are
 * clockwise. Returns {points, triangles}: the points used (the ring, then the holes) and index
 * triples that are counter-clockwise. Work is bounded by the square of the vertex count.
 */
export function triangulate(ring, holes = []) {
  const points = [...ring];
  let loop = ring.map((_, i) => i);
  // Join each hole to the outer loop with a two-way bridge, rightmost hole first.
  const order = holes
    .map((h) => ({ h, x: Math.max(...h.map((p) => p.x)) }))
    .filter((o) => o.h.length >= 3)
    .sort((a, b) => b.x - a.x);
  for (const { h } of order) {
    const base = points.length;
    points.push(...h);
    let hi = 0;
    for (let i = 1; i < h.length; i++) if (h[i].x > h[hi].x) hi = i;
    const from = h[hi];
    let pick = -1,
      bestD = Infinity;
    for (let k = 0; k < loop.length; k++) {
      const p = points[loop[k]];
      const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2;
      if (d >= bestD) continue;
      let clear = true;
      for (let m = 0; m < loop.length && clear; m++) {
        const a = points[loop[m]],
          b = points[loop[(m + 1) % loop.length]];
        if (a === p || b === p) continue;
        if (segmentsCross(from, p, a, b)) clear = false;
      }
      for (let m = 0; m < h.length && clear; m++) {
        const a = h[m],
          b = h[(m + 1) % h.length];
        if (a === from || b === from) continue;
        if (segmentsCross(from, p, a, b)) clear = false;
      }
      if (clear) {
        pick = k;
        bestD = d;
      }
    }
    if (pick < 0) continue; // an unreachable hole is left filled
    const holeLoop = [];
    for (let i = 0; i <= h.length; i++) holeLoop.push(base + ((hi + i) % h.length));
    loop = [...loop.slice(0, pick + 1), ...holeLoop, ...loop.slice(pick)];
  }
  const triangles = [];
  const n0 = loop.length;
  let guard = n0 * n0 + 16;
  let i = 0;
  const convex = (a, b, c) => cross2(points[a], points[b], points[c]) > 1e-9;
  const inside = (a, b, c, p) => {
    const A = points[a],
      B = points[b],
      C = points[c],
      P = points[p];
    return cross2(A, B, P) >= -1e-9 && cross2(B, C, P) >= -1e-9 && cross2(C, A, P) >= -1e-9;
  };
  while (loop.length > 3 && guard-- > 0) {
    const n = loop.length,
      a = loop[(i + n - 1) % n],
      b = loop[i % n],
      c = loop[(i + 1) % n];
    let ear = convex(a, b, c);
    if (ear) {
      for (let k = 0; k < n; k++) {
        const p = loop[k];
        if (p === a || p === b || p === c) continue;
        const P = points[p];
        if (
          (P.x === points[a].x && P.y === points[a].y) ||
          (P.x === points[b].x && P.y === points[b].y) ||
          (P.x === points[c].x && P.y === points[c].y)
        )
          continue;
        if (inside(a, b, c, p)) {
          ear = false;
          break;
        }
      }
    }
    if (ear) {
      triangles.push(a, b, c);
      loop.splice(i % n, 1);
      i = Math.max(0, (i % n) - 1);
    } else i = (i + 1) % n;
  }
  if (loop.length === 3 && convex(loop[0], loop[1], loop[2])) triangles.push(loop[0], loop[1], loop[2]);
  else if (loop.length > 3) {
    // Degenerate input: close what is left as a fan so the roof has no hole.
    for (let k = 1; k + 1 < loop.length; k++)
      if (convex(loop[0], loop[k], loop[k + 1])) triangles.push(loop[0], loop[k], loop[k + 1]);
  }
  return { points, triangles };
}

/**
 * Keep the part of a convex polygon where f(p) <= 0, for a linear function given by its values
 * at each point. Points are arrays; `values[i]` belongs to `poly[i]`. Returns the kept points.
 */
export function clipConvex(poly, values) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length,
      a = poly[i],
      b = poly[j],
      va = values[i],
      vb = values[j];
    if (va <= 0) out.push(a);
    if (va <= 0 !== vb <= 0) {
      const t = va / (va - vb);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
