/** Closed path builders for character parts. Character space is y-down with the ground at y = 0. */
const K = 0.5522847498;
const f = (v) => Object.freeze(v);

export function ellipse(cx, cy, rx, ry = rx) {
  return f([
    f(['M', cx + rx, cy]),
    f(['C', cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry]),
    f(['C', cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy]),
    f(['C', cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry]),
    f(['C', cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy]),
    f(['Z']),
  ]);
}

/** An egg: different radii above and below the widest line, the usual body of a cute character. */
export function egg(cx, cy, rx, top, bottom) {
  return f([
    f(['M', cx + rx, cy]),
    f(['C', cx + rx, cy + bottom * K, cx + rx * K, cy + bottom, cx, cy + bottom]),
    f(['C', cx - rx * K, cy + bottom, cx - rx, cy + bottom * K, cx - rx, cy]),
    f(['C', cx - rx, cy - top * K, cx - rx * K, cy - top, cx, cy - top]),
    f(['C', cx + rx * K, cy - top, cx + rx, cy - top * K, cx + rx, cy]),
    f(['Z']),
  ]);
}

/** A closed polygon whose corners are rounded with quadratic curves; radius is clamped per corner. */
export function rounded(points, radius) {
  const n = points.length,
    out = [];
  const corner = (i) => {
    const p = points[i],
      a = points[(i + n - 1) % n],
      b = points[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]),
      lb = Math.hypot(b[0] - p[0], b[1] - p[1]),
      r = Math.min(radius, la / 2, lb / 2);
    return [
      [p[0] + ((a[0] - p[0]) * r) / la, p[1] + ((a[1] - p[1]) * r) / la],
      p,
      [p[0] + ((b[0] - p[0]) * r) / lb, p[1] + ((b[1] - p[1]) * r) / lb],
    ];
  };
  points.forEach((_, i) => {
    const [start, control, end] = corner(i);
    out.push(f([i ? 'L' : 'M', ...start]), f(['Q', ...control, ...end]));
  });
  out.push(f(['Z']));
  return f(out);
}

/** A smooth closed curve through points (Catmull-Rom converted to cubic Béziers). */
export function smoothClosed(points, tension = 1) {
  const n = points.length,
    out = [f(['M', ...points[0]])];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i + n - 1) % n],
      p1 = points[i],
      p2 = points[(i + 1) % n],
      p3 = points[(i + 2) % n],
      t = tension / 6;
    out.push(
      f([
        'C',
        p1[0] + (p2[0] - p0[0]) * t,
        p1[1] + (p2[1] - p0[1]) * t,
        p2[0] - (p3[0] - p1[0]) * t,
        p2[1] - (p3[1] - p1[1]) * t,
        p2[0],
        p2[1],
      ]),
    );
  }
  out.push(f(['Z']));
  return f(out);
}

/** A smooth open curve through points, for strokes such as limbs, tails and flagella. */
export function smoothOpen(points, tension = 1) {
  const n = points.length,
    out = [f(['M', ...points[0]])];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(n - 1, i + 2)],
      t = tension / 6;
    out.push(
      f([
        'C',
        p1[0] + (p2[0] - p0[0]) * t,
        p1[1] + (p2[1] - p0[1]) * t,
        p2[0] - (p3[0] - p1[0]) * t,
        p2[1] - (p3[1] - p1[1]) * t,
        p2[0],
        p2[1],
      ]),
    );
  }
  return f(out);
}

export function mapCommands(commands, map) {
  return f(
    commands.map(([c, ...v]) => {
      const out = [c];
      for (let i = 0; i < v.length; i += 2) out.push(...map(v[i], v[i + 1]));
      return f(out);
    }),
  );
}
export const translate = (commands, dx, dy) => mapCommands(commands, (x, y) => [x + dx, y + dy]);
export const scaleAbout = (commands, cx, cy, sx, sy = sx) =>
  mapCommands(commands, (x, y) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);

/** Bounds of every coordinate, including control points; enough to place shading. */
export function bounds(commands) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [, ...v] of commands)
    for (let i = 0; i < v.length; i += 2) {
      x0 = Math.min(x0, v[i]);
      x1 = Math.max(x1, v[i]);
      y0 = Math.min(y0, v[i + 1]);
      y1 = Math.max(y1, v[i + 1]);
    }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
