const ring = [
  [-0.33, -0.5],
  [0.33, -0.5],
  [0.5, -0.33],
  [0.5, 0.33],
  [0.33, 0.5],
  [-0.33, 0.5],
  [-0.5, 0.33],
  [-0.5, -0.33],
];
const axes = [0, 1, 2];

export function obstacleMesh(box, bodyBand = -1) {
  // Walls and cabinetry keep flat rectangular faces. Rounded furniture and
  // body bands use tapered polygonal cross sections.
  const rect = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const shape = bodyBand >= 0 || /chair|sofa|shade/i.test(box.label) ? ring : rect;
  const scales = bodyBand === 0 ? [0.65, 1] : bodyBand === 2 ? [1, 0.66] : shape === ring ? [0.85, 1] : [1, 1];
  const center = box.min.map((low, i) => (low + box.max[i]) / 2);
  const span = box.min.map((low, i) => box.max[i] - low);
  const points = scales.flatMap((scale, level) =>
    shape.map(([x, z]) => [
      center[0] + x * span[0] * scale,
      (level ? box.max : box.min)[1],
      center[2] + z * span[2] * scale + (/chair back/i.test(box.label) ? (0.5 - level) * span[2] * 0.32 : 0),
    ]),
  );
  const count = shape.length;
  const faces = [Array.from({ length: count }, (_, i) => i), Array.from({ length: count }, (_, i) => i + count)];
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    faces.push([i, next, next + count, i + count]);
  }
  const planes = faces.map(([i, j, k]) => {
    const a = points[i],
      b = points[j],
      c = points[k];
    const u = b.map((v, axis) => v - a[axis]),
      v = c.map((n, axis) => n - a[axis]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const sign =
      dot(
        n,
        center.map((value, axis) => value - a[axis]),
      ) > 0
        ? -1
        : 1;
    const length = Math.hypot(...n) * sign;
    const normal = n.map((value) => value / length);
    return { normal, offset: dot(normal, a) };
  });
  return {
    min: axes.map((axis) => Math.min(...points.map((p) => p[axis]))),
    max: axes.map((axis) => Math.max(...points.map((p) => p[axis]))),
    vertices: new Float64Array(points.flat()),
    faces,
    planes,
  };
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function meshDistance(mesh, x, y, z) {
  let distance = -Infinity,
    normal;
  for (const plane of mesh.planes) {
    const [a, b, c] = plane.normal;
    const d = a * x + b * y + c * z - plane.offset;
    if (d > distance) {
      distance = d;
      normal = plane.normal;
    }
  }
  return { distance, normal };
}

export function meshHit(mesh, origin, ray) {
  let near = 0,
    far = Infinity;
  for (const { normal, offset } of mesh.planes) {
    const side = dot(normal, ray);
    const delta = offset - dot(normal, origin);
    if (Math.abs(side) < 1e-8) {
      if (delta < 0) return Infinity;
      continue;
    }
    if (side < 0) near = Math.max(near, delta / side);
    else far = Math.min(far, delta / side);
    if (near > far) return Infinity;
  }
  return near > 0.01 ? near : Infinity;
}
