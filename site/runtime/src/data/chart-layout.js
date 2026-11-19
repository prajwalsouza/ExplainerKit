const TAU = 2 * Math.PI;

const line = (a, b) => [
  ['M', ...a],
  ['L', ...b],
];
const circle = (x, y, r) => {
  const k = r * 0.55228475;
  return [
    ['M', x + r, y],
    ['C', x + r, y + k, x + k, y + r, x, y + r],
    ['C', x - k, y + r, x - r, y + k, x - r, y],
    ['C', x - r, y - k, x - k, y - r, x, y - r],
    ['C', x + k, y - r, x + r, y - k, x + r, y],
  ];
};

export function chartLayout(data, connections, type, width, height) {
  const count = data.length;
  const max = Math.max(...data.map(({ value }) => value)) || 1;
  const maxLink = Math.max(...connections.map(({ value }) => value), 0) || 1;
  const size = Math.min(width, height);
  const cx = width * 0.54,
    cy = height * 0.51;
  const radius = size * (type === 'chord' ? 0.393 : 0.315);
  const step = TAU / count;
  const polar = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const angle = (i) => i * step - Math.PI / 2;
  if (type === 'bar') {
    const start = width * 0.24;
    const span = width * 0.61;
    const spacing = (height * 0.83) / count;
    return {
      guides: Array.from({ length: 5 }, (_, i) =>
        line([start + (i * span) / 4, height * 0.06], [start + (i * span) / 4, height * 0.94]),
      ).flat(),
      marks: data.map((row, i) => {
        const y = height * 0.08 + (i + 0.5) * spacing;
        const a = [start, y],
          b = [start + (span * row.value) / max, y];
        return {
          a,
          b,
          commands: line(a, b),
          grain: [],
          width: Math.min(spacing * 0.43, 12),
          label: [start - 9, y],
          align: 'end',
          hit: Math.max(3, spacing * 0.43),
        };
      }),
      edges: [],
    };
  }

  const guide = [radius - 4, radius, radius + 5].flatMap((r) => circle(cx, cy, r));
  for (let i = 0; i < 180; i++) {
    const a = (i * TAU) / 180;
    guide.push(...line(polar(a, radius + 9), polar(a, radius + (i % 5 === 0 ? 15 : 11))));
  }

  const marks = data.map((row, i) => {
    const direction = angle(i);
    const start = radius + 17,
      end = start + (type === 'chord' ? 5 : (size * 0.094 * row.value) / max);
    const a = polar(direction, start),
      b = polar(direction, end);
    const grain = [];
    if (type === 'radial' && row.value > 0) {
      for (let j = 0; j < 9; j++) {
        const ray = direction + (j - 4) * Math.min(step / 20, 0.013);
        grain.push(...line(polar(ray, start), polar(ray, end)));
      }
    }
    const align = Math.cos(direction) > 0.22 ? 'start' : Math.cos(direction) < -0.22 ? 'end' : 'middle';
    return {
      a,
      b,
      commands: line(a, b),
      grain,
      width: type === 'chord' ? 3.6 : 1.5,
      label: polar(direction, end + 13),
      align,
      hit: 15,
    };
  });

  const edges = connections.map(({ source, target, value }) => {
    const a = angle(source.index),
      b = angle(target.index);
    const from = polar(a, radius - 2),
      to = polar(b, radius - 2);
    const bend = type === 'chord' ? 0.52 : 0.17;
    const c1 = polar(a + 0.14, radius * bend),
      c2 = polar(b - 0.2, radius * bend);
    const commands = [
      ['M', ...from],
      ['C', ...c1, ...c2, ...to],
    ];
    const strength = Math.sqrt(value / maxLink);
    const fibers = [-0.045, 0.045].flatMap((offset) => [
      ['M', ...polar(a + offset, radius - 2)],
      [
        'C',
        ...polar(a + offset * 8, radius * 0.33),
        ...polar(b - offset * 8, radius * 0.33),
        ...polar(b + offset, radius - 2),
      ],
    ]);
    return { from, to, c1, c2, commands, strength, fibers };
  });
  return { guides: guide, marks, edges };
}
