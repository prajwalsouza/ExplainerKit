// A bounded reader for the flowchart subset of Mermaid: `flowchart`/`graph` with a direction, node shapes, chained
// and fanned edges with labels, dotted and thick edges, and subgraphs. Styling statements (classDef, class, style,
// linkStyle, click) and comments are accepted and ignored. Nothing is executed and no HTML is interpreted.
import { assert, text } from '../core/validate.js';

export const MAX_FLOW_SOURCE = 65536;
export const MAX_FLOW_NODES = 200;
export const MAX_FLOW_EDGES = 400;
const DIRECTIONS = { TD: 'TB', TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL' };
// Opening bracket → [closing, shape]. Longer openers are tried first.
const SHAPES = [
  ['(((', ')))', 'circle'],
  ['([', '])', 'stadium'],
  ['[[', ']]', 'subroutine'],
  ['[(', ')]', 'database'],
  ['((', '))', 'circle'],
  ['{{', '}}', 'hexagon'],
  ['[/', '/]', 'parallelogram'],
  ['[\\', '\\]', 'parallelogram'],
  ['[', ']', 'rect'],
  ['(', ')', 'round'],
  ['{', '}', 'diamond'],
  ['>', ']', 'flag'],
];
// IDs may hold single hyphens between letters (my-node), never the start of an edge (A-->B).
const ID = /^[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*/;
/**
 * Read one edge operator at the start of `rest`: a run of -, . or = with an optional arrow head, an optional inline
 * label (A -- text --> B) and an optional piped label (A -->|text| B). Returns null when `rest` holds no edge.
 */
function readEdge(rest) {
  let i = 0;
  const skip = () => {
    while (rest[i] === ' ' || rest[i] === '\t') i++;
  };
  skip();
  if (rest[i] === '<') i++;
  const runStart = i;
  while ('-.='.includes(rest[i]) && rest[i] !== undefined) i++;
  let run = rest.slice(runStart, i);
  if (run.length < 2) return null;
  let label = '';
  let head = rest[i] === '>' || ((rest[i] === 'o' || rest[i] === 'x') && /[\s|A-Za-z0-9_]/.test(rest[i + 1] ?? ' '));
  if (head) i++;
  else if (/^(--|==|-\.)$/.test(run) && rest[i] === ' ') {
    // Inline label: A -- text --> B. The label runs to the next operator that ends in an arrow or a line.
    const close = /\s(-{2,}>?|={2,}>?|\.-+>?|-\.+->?)\s*/.exec(rest.slice(i));
    if (close) {
      label = rest.slice(i, i + close.index).trim();
      run = close[1];
      head = run.endsWith('>');
      i += close.index + close[0].length;
    }
  }
  skip();
  if (rest[i] === '|') {
    const end = rest.indexOf('|', i + 1);
    if (end < 0) return null;
    label = rest.slice(i + 1, end);
    i = end + 1;
  }
  skip();
  const style = run.includes('=') ? 'thick' : run.includes('.') ? 'dotted' : 'solid';
  return { length: i, style, arrow: head, label };
}

function clean(label) {
  return label
    .trim()
    .replace(/^"(.*)"$/s, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

/**
 * Read a Mermaid flowchart into nodes, edges and groups.
 * @param {string} source
 * @returns {{direction: 'TB'|'BT'|'LR'|'RL', nodes: {id: string, label: string, shape: string, group: string|null}[],
 *   edges: {from: string, to: string, label: string, style: 'solid'|'dotted'|'thick', arrow: boolean}[],
 *   groups: {id: string, title: string, members: string[]}[]}}
 */
export function parseMermaidFlow(source) {
  text(source, 'Mermaid source', MAX_FLOW_SOURCE);
  const lines = source
    .replace(/%%[^\n]*/g, '')
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert(lines.length > 0, 'INVALID_FLOW', 'The Mermaid source is empty.');
  const head = /^(flowchart|graph)\s*(TD|TB|BT|LR|RL)?\s*$/i.exec(lines[0]);
  assert(head, 'INVALID_FLOW', 'Start the diagram with flowchart or graph and a direction, such as flowchart TD.');
  const direction = DIRECTIONS[(head[2] ?? 'TD').toUpperCase()];
  const nodes = new Map(),
    edges = [],
    groups = [],
    stack = [];
  function node(id, label, shape) {
    if (!nodes.has(id)) {
      assert(nodes.size < MAX_FLOW_NODES, 'RESOURCE_LIMIT', `A flowchart holds at most ${MAX_FLOW_NODES} nodes.`);
      nodes.set(id, { id, label: id, shape: 'rect', group: null });
    }
    const n = nodes.get(id);
    // Naming an existing node inside a subgraph moves it there, as Mermaid does.
    const open = stack.at(-1);
    if (open && n.group !== open.id) {
      for (const g of groups) g.members = g.members.filter((m) => m !== id);
      n.group = open.id;
      open.members.push(id);
    }
    if (label !== undefined) {
      n.label = clean(label) || id;
      n.shape = shape;
    }
    return n;
  }
  /** One node reference at the start of `rest`: an ID and an optional shape. Returns the IDs and what follows. */
  function reference(rest) {
    const ids = [];
    for (;;) {
      const m = ID.exec(rest);
      assert(m, 'INVALID_FLOW', `Expected a node ID near "${rest.slice(0, 24)}".`);
      const id = m[0];
      rest = rest.slice(id.length);
      const shape = SHAPES.find(([open]) => rest.startsWith(open));
      if (shape) {
        const [open, close, kind] = shape;
        const end = rest.indexOf(close, open.length);
        assert(end >= 0, 'INVALID_FLOW', `Node ${id} has an unclosed shape.`);
        node(id, rest.slice(open.length, end), kind);
        rest = rest.slice(end + close.length);
      } else node(id);
      ids.push(id);
      rest = rest.replace(/^:::[\w-]+/, '').trimStart();
      if (!rest.startsWith('&')) return [ids, rest];
      rest = rest.slice(1).trimStart();
    }
  }
  for (const line of lines.slice(1)) {
    const sub = /^subgraph\s+([\w-]+)?\s*(?:\[(.*)\])?\s*(.*)$/.exec(line);
    if (sub) {
      const id = sub[1] ?? `group${groups.length + 1}`;
      const group = { id, title: clean(sub[2] ?? sub[3] ?? '') || id, members: [] };
      groups.push(group);
      stack.push(group);
      continue;
    }
    if (/^end$/i.test(line)) {
      stack.pop();
      continue;
    }
    if (/^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/.test(line)) continue;
    let [from, rest] = reference(line);
    while (rest) {
      const edge = readEdge(rest);
      assert(edge, 'INVALID_FLOW', `Expected an edge such as --> near "${rest.slice(0, 24)}".`);
      const { style, arrow } = edge,
        label = clean(edge.label);
      rest = rest.slice(edge.length);
      const [to, after] = reference(rest);
      for (const a of from)
        for (const b of to) {
          assert(edges.length < MAX_FLOW_EDGES, 'RESOURCE_LIMIT', `A flowchart holds at most ${MAX_FLOW_EDGES} edges.`);
          edges.push({ from: a, to: b, label, style, arrow });
        }
      from = to;
      rest = after;
    }
  }
  return {
    direction,
    nodes: [...nodes.values()],
    edges,
    groups: groups.filter((g) => g.members.length),
  };
}
