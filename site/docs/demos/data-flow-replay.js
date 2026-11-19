import {mountFlowChart} from '../../runtime/src/data/index.js';

// An agent run: a prompt goes in, a router hands work to modules, tools answer, a writer composes the reply.
const source = `flowchart LR
  U([User prompt]) --> P[Planner]
  P -->|route| R{Router}
  R -->|search| S[(Web search)]
  R -->|code| C[[Code runner]]
  R -.->|recall| M((Memory))
  S ==> W[Writer]
  C ==> W
  M -.-> W
  W --> V{Reviewer}
  V -->|revise| P
  V -->|ship| A>Answer]
  subgraph tools [Tools]
    S
    C
  end`;

const steps = [
  { from: 'U', to: 'P', label: 'prompt', input: 'How fast does light cross the Atlantic in fibre?', output: 'Goal: estimate latency; needs distance and fibre index.' },
  { from: 'P', to: 'R', label: 'plan', input: '1. distance  2. refractive index  3. compute', output: 'two tool calls' },
  { from: 'R', to: 'S', label: 'query', input: 'transatlantic cable length', output: '≈ 6,600 km (MAREA)' },
  { from: 'R', to: 'M', label: 'recall', input: 'fibre refractive index', output: 'n ≈ 1.47' },
  { from: 'R', to: 'C', label: 'compute', input: '6.6e6 * 1.47 / 3e8', output: '0.0323 s' },
  { from: 'S', to: 'W', label: 'distance' },
  { from: 'C', to: 'W', label: '32 ms' },
  { from: 'M', to: 'W', label: 'n = 1.47' },
  { from: 'W', to: 'V', label: 'draft', input: 'About 32 ms one way.', output: 'missing round trip' },
  { from: 'V', to: 'P', label: 'revise', output: 'add round trip' },
  { from: 'P', to: 'R', label: 'replan' },
  { from: 'R', to: 'C', label: 'compute ×2', output: '0.0647 s' },
  { from: 'C', to: 'W', label: '65 ms' },
  { from: 'W', to: 'V', label: 'draft 2' },
  { from: 'V', to: 'A', label: 'ship', output: 'About 32 ms one way, 65 ms there and back.' },
];
const MAX_BYTES = 65536;
/** Mermaid text from pasted or dropped content, with any ```mermaid fence around it removed. */
const unfence = (text) => text.replace(/^\s*```\s*mermaid\s*\n([\s\S]*?)\n\s*```\s*$/i, '$1').trim();

export default async function flowReplay(stage) {
  const chartHost = document.createElement('div');
  const editor = document.createElement('details');
  editor.style.margin = '.7rem 0 0';
  const summary = document.createElement('summary');
  summary.textContent = 'Paste or drop your own Mermaid flowchart';
  summary.style.cursor = 'pointer';
  const area = document.createElement('textarea');
  area.value = source;
  area.spellcheck = false;
  area.setAttribute('aria-label', 'Mermaid flowchart source');
  Object.assign(area.style, {
    width: '100%', minHeight: '12rem', boxSizing: 'border-box', marginTop: '.5rem',
    font: '0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace', padding: '.6rem', borderRadius: '.4rem',
  });
  const draw = document.createElement('button');
  draw.type = 'button';
  draw.textContent = 'Draw this flowchart';
  draw.style.marginTop = '.4rem';
  const status = document.createElement('p');
  status.setAttribute('aria-live', 'polite');
  status.style.margin = '.4rem 0 0';
  editor.append(summary, area, draw, status);
  stage.append(chartHost, editor);

  let flow = null;
  async function show(text, withSteps) {
    const next = unfence(text);
    let mounted;
    try {
      // The bundled run keeps its scripted steps; any other flowchart replays each of its edges in order.
      mounted = await mountFlowChart(chartHost, next, {
        ...(withSteps ? {steps} : {}),
        label: withSteps ? 'An agent run, step by step' : 'Your flowchart',
        theme: flow?.theme ?? 'silk',
      });
    } catch (error) {
      status.textContent = 'This flowchart could not be drawn: ' + error.message;
      return;
    }
    flow?.dispose();
    flow = mounted;
    status.textContent = withSteps ? '' : `Drawn: ${flow.layout.nodes.length} nodes, ${flow.layout.edges.length} edges.`;
  }
  draw.addEventListener('click', () => show(area.value, area.value.trim() === source.trim()));
  // Drop a .mmd, .md or .txt file (or dragged text) anywhere on the demo.
  stage.addEventListener('dragover', (event) => {
    event.preventDefault();
    stage.style.outline = '2px dashed currentColor';
  });
  stage.addEventListener('dragleave', () => (stage.style.outline = ''));
  stage.addEventListener('drop', async (event) => {
    event.preventDefault();
    stage.style.outline = '';
    const file = event.dataTransfer?.files?.[0];
    let text = event.dataTransfer?.getData('text/plain') ?? '';
    if (file) {
      if (file.size > MAX_BYTES) {
        status.textContent = 'That file is larger than 64 KiB.';
        return;
      }
      text = await file.text();
    }
    if (!text.trim()) return;
    area.value = unfence(text);
    editor.open = true;
    await show(text, false);
  });
  await show(source, true);
  return () => flow?.dispose();
}
