// The final script, three ways. The outline is the narration itself, split into lines so each claim and source can sit
// beneath the sentence it supports: renderOutline (explainerkit/design) writes it, and this card folds it. "Narration
// only" reads the same script straight through, as it would be spoken. "Checks" runs the module's fixed, non-model
// checks on it, live: the counts, the voice gate, spoken jargon, citations and the telling's structure. The result is a
// complete real run (see design-sample.js).
import { checkTelling, philosophyJargon, renderOutline, scriptStats, shortRuns, voiceProblems } from '../../runtime/src/design/index.js';
import { css } from './_kit.js';
import sample from './design-sample.js';

const TAGS = {
  title: 0, form: 200, topic: 200, audience: 200, seed: 200, shape: 200, checks: 140, uncited: 20, 'unknown-claims': 20,
  insight: 43, aha: 43, eureka: 43, because: 43, cues: 195, surprise: 25, leak: 350, lost: 326,
  section: 0, narration: 0, visual: 280, note: 40, claim: 150, source: 210,
};
const CSS = `
.do { padding: 16px 0 4px; font-size: 14px; }
.do-bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.do-bar button { font: 600 12.5px var(--sans); color: var(--muted); background: none; border: 1px solid var(--line); border-radius: 999px; padding: 5px 12px; cursor: pointer; }
.do-bar button[aria-pressed="true"] { color: var(--ink); border-color: hsl(var(--h) var(--accent-s) var(--accent-l)); }
.do-bar span { font-size: 12.5px; color: var(--muted); margin-left: 6px; }
.do label { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.do select { font: inherit; color: var(--ink); background: var(--panel); border: 1px solid var(--line); padding: 5px 8px; border-radius: 6px; }
.do ul { list-style: none; margin: 0; padding: 0 0 0 18px; }
.do .do-tree > ul { padding-left: 0; }
.do li { position: relative; margin: 3px 0; line-height: 1.55; }
.do li.parent > .row { cursor: pointer; }
.do li.parent > .row::before { content: "▾"; position: absolute; left: -14px; top: 1px; font-size: 11px; color: var(--muted); transition: transform .15s; }
.do li.folded > .row::before { transform: rotate(-90deg); }
.do li.folded > ul { display: none; }
.do .tag { display: inline-block; font: 600 10.5px var(--mono); letter-spacing: .02em; padding: 1px 6px; margin-right: 7px; border-radius: 5px; vertical-align: 1px; color: hsl(var(--tag-h) 45% 40%); background: hsl(var(--tag-h) 45% 50% / .12); }
:root.dark .do .tag { color: hsl(var(--tag-h) 50% 72%); background: hsl(var(--tag-h) 45% 60% / .16); }
.do .text { color: var(--ink); }
.do .tag-visual + .text, .do .tag-note + .text, .do .tag-source + .text { color: var(--muted); font-size: 13px; }
.do .tag-section + .text { font: 600 13px var(--mono); }
.do .tag-source + .text a { color: inherit; }
.do pre { max-height: 420px; overflow: auto; white-space: pre-wrap; font-size: 12px; }
.do-prose { max-width: 66ch; font: 16.5px/1.75 var(--sans); color: var(--ink); }
.do-prose h4 { font: 650 22px/1.3 var(--display); letter-spacing: -.01em; margin: 4px 0 18px; }
.do-prose p { margin: 0 0 16px; }
.do-checks { display: grid; gap: 10px; max-width: 760px; }
.do-check { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding: 10px 12px; border-radius: 10px; background: var(--code-bg); }
.do-check .mark { font: 700 13px var(--sans); }
.do-check .mark.ok { color: hsl(150 45% 38%); }
.do-check .mark.flag { color: hsl(18 75% 48%); }
:root.dark .do-check .mark.ok { color: hsl(150 45% 62%); }
:root.dark .do-check .mark.flag { color: hsl(18 80% 64%); }
.do-check b { display: block; font: 600 13.5px var(--sans); color: var(--ink); }
.do-check span.what { font-size: 13px; color: var(--muted); }
.do-check .value { font: 600 13px var(--mono); color: var(--ink); white-space: nowrap; }
`;

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Parse the outline's indented "- [tag] text" lines into a tree. */
function parse(text) {
  const root = { children: [] }, stack = [{ depth: -1, node: root }];
  for (const line of text.split('\n')) {
    const m = /^( *)- \[([a-z-]+)\] ?(.*)$/.exec(line);
    if (!m) continue;
    const node = { tag: m[2], text: m[3], children: [] }, depth = m[1].length / 2;
    while (stack.at(-1).depth >= depth) stack.pop();
    stack.at(-1).node.children.push(node);
    stack.push({ depth, node });
  }
  return root.children;
}

function filterTree(nodes, tags) {
  return nodes.flatMap((node) => {
    if (tags.has(node.tag)) return [node];
    const children = filterTree(node.children, tags);
    return children.length ? [{ ...node, children }] : [];
  });
}

function html(nodes, depth = 0) {
  return `<ul>${nodes
    .map((n) => {
      const parent = n.children.length > 0, folded = parent && depth >= 1 && n.tag === 'claim';
      const body = n.tag === 'source' ? escape(n.text).replace(/(https?:\/\/\S+)/, '<a href="$1" rel="noopener">$1</a>') : escape(n.text);
      return `<li data-tag="${n.tag}"${n.paragraph === undefined ? '' : ` data-paragraph="${n.paragraph}"`} class="${parent ? 'parent' : ''}${folded ? ' folded' : ''}"><div class="row"${parent ? ` tabindex="0" role="button" aria-expanded="${!folded}"` : ''}><span class="tag tag-${n.tag}" style="--tag-h:${TAGS[n.tag] ?? 0}">${n.tag}</span><span class="text">${body}</span></div>${parent ? html(n.children, depth + 1) : ''}</li>`;
    })
    .join('')}</ul>`;
}

/** The fixed checks, run on the sample now: each with what it looks at, its value and whether it passes. */
function checks(result, text) {
  const stats = scriptStats(text), runs = shortRuns(text), jargon = Object.keys(philosophyJargon(text));
  const gate = voiceProblems(stats, undefined, runs);
  const structure = checkTelling(result.telling);
  const uncited = result.script.sections.filter((x) => !x.cites?.length).map((x) => x.beat);
  const known = new Set(result.research.claims.map((c) => c.id));
  const unknown = [...new Set(result.script.sections.flatMap((x) => x.cites ?? []).filter((id) => !known.has(id)))];
  const rows = [
    ['Length', 'Words and spoken minutes at 150 words a minute.', `${stats.words} words · ${stats.estimatedMinutes} min`, true],
    ['Rhythm', 'How much sentence lengths vary. Narration needs short and long sentences; the gate asks for at least 7.', `spread ${stats.sentenceSpread}`, stats.sentenceSpread >= 7],
    ['Choppy runs', 'Runs of three or more short sentences in a row.', `${runs.length}`, runs.length <= 2],
    ['Hedges', 'Spoken qualifications per 100 words; the gate allows about 2.2.', `${stats.hedgesPer100Words}`, stats.hedgesPer100Words <= 2.2],
    ['Narrator', 'How often the host speaks as “I” or “we”, per 100 words.', `${stats.narratorPer100Words}`, stats.narratorPer100Words >= 1],
    ['Instructions', 'Sentences that open by telling the viewer what to do.', `${stats.instructionSentences}`, stats.instructionSentences / Math.max(1, stats.sentences) <= 0.08],
    ['Stock phrases', 'Narration clichés such as “in this video”.', stats.stockPhrases.join(', ') || 'none', !stats.stockPhrases.length],
    ['Placeholders', 'Bracketed notes that leave a result to be filled in.', `${stats.placeholders.length}`, !stats.placeholders.length],
    ['Spoken jargon', 'Names of philosophical debates or technical terms said aloud.', jargon.join(', ') || 'none', !jargon.length],
    ['Citations', 'Sections that cite no research claim, and cited ids that are not in the research.', `${uncited.length} uncited · ${unknown.length} unknown`, !unknown.length],
    ['Structure', 'Ideas arrive before they are needed, clues are planted before they are recalled, questions opened are closed.', `${structure.errors.length} problems`, !structure.errors.length],
    ['Cascade', 'How many earlier beats the reveal recalls.', `${structure.measures.cascade} beats`, structure.measures.cascade >= 3],
    ['Voice gate', 'Whether the explainer would ask for a final voice polish.', gate.length ? `${gate.length} problems` : 'passes', !gate.length],
  ];
  return `<div class="do-checks">${rows
    .map(([name, what, value, ok]) => `<div class="do-check"><span class="mark ${ok ? 'ok' : 'flag'}">${ok ? '✓' : '!'}</span><div><b>${escape(name)}</b><span class="what">${escape(what)}</span></div><span class="value">${escape(value)}</span></div>`)
    .join('')}</div>`;
}

export default async function designOutline(stage, ctx = {}) {
  css('design-outline', CSS);
  const draft = ctx.draft;
  const text = draft?.text ?? renderOutline(sample);
  const sections = draft?.sections ?? sample.script.sections, narration = sections.map((x) => x.narration).join('\n\n');
  const prose = `<div class="do-prose"><h4>${escape(draft?.title ?? sample.title.chosen)}</h4>${sections.flatMap((x) => x.narration.split(/\n\s*\n/)).map((p) => `<p>${escape(p.trim())}</p>`).join('')}</div>`;
  const filters = {
    all: null,
    insights: new Set(['insight', 'aha', 'eureka', 'because', 'cues', 'surprise', 'leak', 'lost']),
    narration: new Set(['narration', 'text']),
    visuals: new Set(['visual', 'note']),
    sources: new Set(['claim', 'source']),
  };
  const filterControl = draft ? '<label>Show <select aria-label="Filter outline"><option value="all">All entries</option><option value="insights">Insights</option><option value="narration">Narration</option><option value="visuals">Visuals and notes</option><option value="sources">Claims and sources</option></select></label>' : '';
  const auditNotes = draft?.problems?.length
    ? `<ul>${draft.problems.map((problem) => `<li>${escape(problem)}</li>`).join('')}</ul>`
    : '';
  const checksMarkup = draft
    ? `<p>${escape(scriptStats(narration).words)} words of narration.</p>${auditNotes}`
    : checks(sample, narration);
  const nodes = parse(text);
  const sceneParagraphs = new Map();
  if (ctx.inlineNarration) {
    for (const [sceneIndex, scene] of sections.entries()) {
      for (const [paragraphIndex, paragraph] of scene.narration.split(/\n\s*\n/).entries()) {
        const key = paragraph.replace(/\s+/g, ' ').trim();
        if (!key) continue;
        const matches = sceneParagraphs.get(key) ?? [];
        matches.push({ sceneIndex, paragraphIndex });
        sceneParagraphs.set(key, matches);
      }
    }
  }
  const paragraphs = [];
  function indexParagraphs(children) {
    for (const node of children) {
      const match = ['narration', 'text'].includes(node.tag) && sceneParagraphs.get(node.text)?.shift();
      if (match) node.paragraph = paragraphs.push(match) - 1;
      indexParagraphs(node.children);
    }
  }
  indexParagraphs(nodes);
  stage.innerHTML = `<div class="do"><div class="do-bar" role="group" aria-label="View"><button type="button" aria-pressed="true" data-view="tree">Outline</button><button type="button" aria-pressed="false" data-view="prose">Narration only</button><button type="button" aria-pressed="false" data-view="checks">Checks</button><button type="button" aria-pressed="false" data-view="text">Raw text</button><span class="hint">${ctx.inlineNarration ? 'Choose a sentence to see how it was written.' : 'Choose a row with children to fold it. Claims start folded.'}</span></div><div class="do-view" data-view="tree">${filterControl}<div class="do-tree">${html(nodes)}</div></div><div class="do-view" data-view="prose" hidden>${prose}</div><div class="do-view" data-view="checks" hidden>${checksMarkup}</div><div class="do-view" data-view="text" hidden><pre><code>${escape(text)}</code></pre></div></div>`;
  const tree = stage.querySelector('.do-tree');
  const events = new AbortController();
  function mountNarration() {
    for (const row of tree.querySelectorAll('[data-paragraph] > .row')) {
      const { sceneIndex, paragraphIndex } = paragraphs[Number(row.parentElement.dataset.paragraph)];
      row.querySelector('.text').replaceWith(ctx.inlineNarration(sceneIndex, paragraphIndex));
    }
  }
  mountNarration();
  const proseView = stage.querySelector('.do-prose');
  let proseMounted = false;
  function mountProse() {
    if (!ctx.inlineNarration || proseMounted) return;
    proseMounted = true;
    const paragraphs = [];
    for (const [sceneIndex, scene] of sections.entries()) {
      for (const [paragraphIndex, text] of scene.narration.split(/\n\s*\n/).entries()) {
        if (text.trim()) paragraphs.push(ctx.inlineNarration(sceneIndex, paragraphIndex, 'prose'));
      }
    }
    const guide = ctx.narrationGuide?.();
    proseView.replaceChildren(...(guide ? [guide, ...paragraphs] : paragraphs));
  }
  stage.querySelector('select')?.addEventListener('change', (event) => {
    const filter = filters[event.target.value];
    const visible = filter ? filterTree(nodes, filter) : nodes;
    tree.innerHTML = visible.length ? html(visible) : '<p>No entries match this filter.</p>';
    mountNarration();
  }, { signal: events.signal });
  stage.querySelector('.do-bar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    stage.querySelectorAll('.do-bar button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    stage.querySelectorAll('.do-view').forEach((v) => (v.hidden = v.dataset.view !== b.dataset.view));
    stage.querySelector('.hint').hidden = b.dataset.view !== 'tree';
    if (b.dataset.view === 'prose') mountProse();
  }, { signal: events.signal });
  const toggle = (event) => {
    if (event.target.closest('a')) return;
    const row = event.target.closest('.row[role=button]');
    if (!row) return;
    const folded = row.parentElement.classList.toggle('folded');
    row.setAttribute('aria-expanded', String(!folded));
  };
  tree.addEventListener('click', toggle, { signal: events.signal });
  tree.addEventListener('keydown', (event) => {
    if (!event.target.matches('.row[role=button]') || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    toggle(event);
  }, { signal: events.signal });
  return () => events.abort();
}
