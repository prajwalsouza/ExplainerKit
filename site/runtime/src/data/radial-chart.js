import { assert, number, options } from '../core/validate.js';
import { chartTheme } from './chart-themes.js';
import { chartData } from './chart-data.js';

const TAU = Math.PI * 2;
const MAX_ENTRANCE = 2.34;

/**
 * Draw values as radial spokes and optional relationships as curved links.
 * @param {import('../core/scene.js').Scene} drawing
 * @param {ReadonlyArray<{id: string, value: number, label?: string, highlight?: boolean}>} rows
 * @param {{links?: ReadonlyArray<{from: string, to: string}>, theme?: Parameters<typeof chartTheme>[0], cx?: number,
 *          cy?: number, radius?: number, at?: number, motion?: boolean}} [spec]
 * @returns {ReturnType<import('../core/scene.js').Scene['group']>}
 */
export function radialChart(drawing, rows, spec = {}) {
  options(spec, ['links', 'theme', 'cx', 'cy', 'radius', 'at', 'motion'], 'radial chart');
  const theme = chartTheme(spec.theme),
    cx = number(spec.cx ?? 320, 'chart center x', -1e6, 1e6),
    cy = number(spec.cy ?? 200, 'chart center y', -1e6, 1e6),
    radius = number(spec.radius ?? 170, 'chart radius', 24, 4096),
    at = number(spec.at ?? 0, 'chart start', 0, 86400 - MAX_ENTRANCE),
    motion = spec.motion ?? true,
    links = spec.links ?? [];
  assert(typeof motion === 'boolean', 'INVALID_OPTIONS', 'Chart motion must be boolean.');
  const { data, connections: linksById } = chartData(rows, links);
  const step = TAU / data.length;
  const angleFor = ({ index }) => index * step - Math.PI / 2;
  const max = Math.max(...data.map((row) => row.value));
  const connections = linksById.map(({ source, target }, i) => {
    const highlighted = source.highlight && target.highlight;
    return { source, target, highlighted, trace: i % 4 === 0 || highlighted };
  });

  const signal = theme.motion !== 'grow';
  const pulseCount = motion && signal ? connections.filter(({ trace }) => trace).length : 0;
  const markCount = data.reduce((total, row) => total + Number(row.value > 0) + Number(Boolean(row.label)), 0);
  assert(
    drawing.nodeCount + 5 + connections.length + pulseCount + markCount <= drawing.maxNodes,
    'RESOURCE_LIMIT',
    'The chart exceeds the remaining scene node budget.',
  );

  const ring = radius * 0.62;
  const start = radius * 0.67;
  const point = (angle, r) => [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  return drawing._batch(() => {
    const group = drawing.group();
    // A rectangular background keeps the theme self-contained when charts share a scene.
    group.rect({
      x: cx - radius * 1.4,
      y: cy - radius * 1.12,
      width: radius * 2.8,
      height: radius * 2.24,
      fill: theme.background,
    });
    for (const r of [ring, start, radius]) {
      group.circle({ x: cx, y: cy, r, fill: 'none', stroke: theme.grid, strokeWidth: r === ring ? 1.1 : 0.6 });
    }

    connections.forEach(({ source, target, highlighted, trace }, i) => {
      const color = highlighted ? theme.accent : theme.mark;
      const a = angleFor(source),
        b = angleFor(target);
      const commands = [
        ['M', ...point(a, ring)],
        ['C', ...point(a, ring * 0.21), ...point(b, ring * 0.35), ...point(b, ring)],
      ];
      const delay = at + 0.32 + (0.68 * i) / Math.max(1, connections.length - 1);
      const baseline = highlighted ? 0.64 : signal ? 0.22 : 0.36;
      const link = group.path({
        commands,
        fill: 'none',
        stroke: color,
        strokeWidth: highlighted ? 1.2 : 0.75,
        opacity: motion && !signal ? 0 : baseline,
        trimEnd: motion && signal ? 0 : 1,
      });
      if (motion && signal) {
        link.to(delay, { trimEnd: 1 }, { duration: 0.96, ease: 'easeOut' });
        if (trace) {
          const pulse = group.path({
            commands,
            fill: 'none',
            stroke: color,
            strokeWidth: 2,
            opacity: 0,
            trimStart: 0,
            trimEnd: 0,
          });
          pulse.to(delay, { opacity: 1 }, { duration: 0.13 });
          pulse.to(delay + 0.03, { trimEnd: 1 }, { duration: 1.15 });
          pulse.to(delay + 0.19, { trimStart: 1 }, { duration: 1.15 });
          pulse.to(delay + 1, { opacity: 0 }, { duration: 0.34 });
        }
      } else if (motion) {
        link.to(delay, { opacity: baseline }, { duration: 0.8, ease: 'easeOut' });
      }
    });

    data.forEach((row, i) => {
      const direction = angleFor(row);
      const span = max > 0 ? (radius - start) * (row.value / max) : 0;
      const color = row.highlight ? theme.accent : theme.mark;
      const commands = [
        ['M', ...point(direction, start)],
        ['L', ...point(direction, start + span)],
      ];
      const delay = at + (signal ? (i / data.length) * 1.35 : (i / data.length) * 0.48);
      if (span > 0) {
        const spoke = group.path({
          commands,
          fill: 'none',
          stroke: color,
          strokeWidth: Math.min(signal ? 2 : 5, step * start * 0.67),
          opacity: row.highlight ? 1 : 0.82,
          trimEnd: motion ? 0 : 1,
        });
        if (motion) spoke.to(delay, { trimEnd: 1 }, { duration: signal ? 0.46 : 0.82, ease: 'easeOut' });
      }
      if (row.label) {
        const [x, y] = point(direction, radius + 5);
        const label = group.text({
          x,
          y,
          align: 'middle',
          baseline: 'middle',
          text: row.label,
          fontSize: radius * 0.069,
          fill: row.highlight ? theme.accent : theme.text,
          opacity: motion ? 0 : 1,
        });
        if (motion) label.to(delay + 0.35, { opacity: 1 }, { duration: 0.4 });
      }
    });

    return group;
  });
}
