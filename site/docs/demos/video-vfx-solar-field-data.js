// NASA NSSDCA equatorial diameters. The Sun uses the mean diameter.
export const bodies = [
  { name: 'Sun', diameter: 1391400, flattening: 0 },
  { name: 'Mercury', diameter: 4879, flattening: 0 },
  { name: 'Venus', diameter: 12104, flattening: 0 },
  { name: 'Earth', diameter: 12756, flattening: 0.0034 },
  { name: 'Mars', diameter: 6792, flattening: 0.006 },
  { name: 'Jupiter', diameter: 142984, flattening: 0.065 },
  { name: 'Saturn', diameter: 120536, flattening: 0.098 },
  { name: 'Uranus', diameter: 51118, flattening: 0.023 },
  { name: 'Neptune', diameter: 49528, flattening: 0.017 },
];

export const AU_KM = 149597870.7;
export const actualDiameter = (body, metresPerAU) => (body.diameter / AU_KM) * metresPerAU;
export const formatSize = (metres) =>
  metres < 0.01 ? `${(metres * 1000).toFixed(2)} mm` : `${(metres * 100).toFixed(1)} cm`;

const rad = Math.PI / 180;

export function stateAt(ephemeris, index, days) {
  const { startDay, endDay, stepDays, bodies: tables } = ephemeris;
  const t = Math.max(startDay, Math.min(endDay, days));
  const table = tables[index];
  const f = (t - startDay) / stepDays;
  const i = Math.min(Math.floor(f), table.samples.length - 2);
  const [a, b] = [table.samples[i], table.samples[i + 1]];
  const u = f - i,
    u2 = u * u,
    u3 = u2 * u;
  const position = a
    .slice(0, 3)
    .map(
      (x, k) =>
        (2 * u3 - 3 * u2 + 1) * x +
        (u3 - 2 * u2 + u) * stepDays * a[k + 3] +
        (-2 * u3 + 3 * u2) * b[k] +
        (u3 - u2) * stepDays * b[k + 3],
    );
  const axis = a.slice(6).map((x, k) => x + (b[k + 6] - x) * u);
  const theta = ((table.spinDegPerDay * t) % 360) * rad;
  const c = Math.cos(theta),
    s = Math.sin(theta);
  const orientation = [
    ...axis.slice(0, 3).map((x, k) => x * c - axis[k + 6] * s),
    ...axis.slice(3, 6),
    ...axis.slice(6).map((z, k) => axis[k] * s + z * c),
  ];
  return { position, orientation };
}

export function calendar(days) {
  return new Date(Date.UTC(2000, 0, 1, 12) + days * 86400000);
}

export const chapters = [
  { time: 0, name: 'Earth' },
  { time: 12, name: 'The wide shot' },
  { time: 26, name: 'The outer planets' },
];
