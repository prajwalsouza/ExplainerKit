import { assert, number, options, text } from '../core/validate.js';

function chartEntry(list, index) {
  const descriptor = Object.getOwnPropertyDescriptor(list, index);
  assert(descriptor && 'value' in descriptor, 'INVALID_DATA', 'Chart arrays must contain dense values.');
  return descriptor.value;
}

export function chartData(rows, links, weighted = false) {
  assert(Array.isArray(rows) && rows.length >= 1 && rows.length <= 128, 'INVALID_DATA', 'Use 1–128 chart rows.');
  assert(Array.isArray(links) && links.length <= 256, 'INVALID_DATA', 'Use at most 256 chart links.');
  const byId = new Map();
  const data = Array.from({ length: rows.length }, (_, index) => {
    const row = chartEntry(rows, index);
    options(row, ['id', 'value', 'label', 'highlight', 'group', 'heat'], 'chart row');
    const id = text(row.id, 'chart id', 128);
    assert(id.length > 0 && !byId.has(id), 'INVALID_DATA', 'Chart IDs must be nonempty and unique.');
    const value = number(row.value, 'chart value', 0, 1e100);
    const label = row.label === undefined ? undefined : text(row.label, 'chart label', 64);
    assert(
      row.highlight === undefined || typeof row.highlight === 'boolean',
      'INVALID_DATA',
      'Highlight must be boolean.',
    );
    const group = row.group === undefined ? undefined : text(row.group, 'chart group', 64);
    const heat = row.heat === undefined ? undefined : number(row.heat, 'chart heat', 0, 1);
    const result = { id, value, label, highlight: Boolean(row.highlight), group, heat, index };
    byId.set(id, result);
    return result;
  });
  const connections = Array.from({ length: links.length }, (_, index) => {
    const link = chartEntry(links, index);
    options(link, weighted ? ['from', 'to', 'value', 'heat'] : ['from', 'to'], 'chart link');
    const source = byId.get(text(link.from, 'link start ID', 128));
    const target = byId.get(text(link.to, 'link end ID', 128));
    assert(source && target && source !== target, 'INVALID_DATA', 'A link must name two different chart IDs.');
    const heat = link.heat === undefined ? undefined : number(link.heat, 'link heat', 0, 1);
    return { source, target, value: number(link.value ?? 1, 'link value', 0, 1e100), heat };
  });
  return { data, connections, byId };
}
