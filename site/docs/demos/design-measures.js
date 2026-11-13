// Measures on narration, live. Edit the text: scriptStats counts it, shortRuns finds the runs of short sentences that
// make narration sound choppy, and voiceProblems applies the voice gate the explainer uses before its last polish.
// Choppy runs are marked in the preview; hedge words are underlined.
import { HEDGES, scriptStats, shortRuns, voiceProblems } from '../../runtime/src/design/index.js';
import { css } from './_kit.js';

const START = `Here is a strip of paper. It has two lines. One wavers. One is regular. You can follow them with a finger. You will not hear a thing.

The paper was blackened with soot in 1860, and a stylus scratched the lines through it while someone sang, which may be why I keep wanting to put my ear to it even though I know it can't possibly work that way.

The trace may be incomplete under some conditions, and the reconstruction can generally be considered approximate. Look at the second line. Count its wiggles. Compare them with the first.`;

const CSS = `
.dm { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; padding: 16px 0 4px; font-size: 14px; }
@media (max-width: 860px) { .dm { grid-template-columns: 1fr; } }
.dm textarea { width: 100%; min-height: 250px; box-sizing: border-box; resize: vertical; font: 14px/1.55 var(--sans); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.dm .preview { font-size: 14px; line-height: 1.6; color: var(--ink); }
.dm .preview p { margin: 0 0 10px; }
.dm mark { background: hsl(var(--h) 70% 60% / .22); color: inherit; border-radius: 3px; padding: 0 1px; }
.dm .hedge { text-decoration: underline wavy hsl(18 80% 52% / .8); text-underline-offset: 3px; }
.dm .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
.dm .stat b { display: block; font: 650 19px var(--display); color: var(--ink); font-variant-numeric: tabular-nums; }
.dm .stat span { font-size: 11.5px; color: var(--muted); }
.dm .gate { margin: 0; padding-left: 18px; font-size: 13px; color: var(--ink); }
.dm .gate li { margin-bottom: 4px; }
.dm .ok { font-size: 13px; color: var(--muted); }
.dm label { display: block; font: 600 11.5px var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
`;
const escape = (text) => String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const hedgeWord = new RegExp(`\\b(${HEDGES.join('|')})\\b`, 'gi');

export default async function designMeasures(stage) {
  css('design-measures', CSS);
  stage.innerHTML = `<div class="dm"><div><label for="dm-text">Narration</label><textarea id="dm-text" spellcheck="false"></textarea></div><div><label>What the measures see</label><div class="preview"></div><div class="stats"></div><div class="verdict"></div></div></div>`;
  const area = stage.querySelector('textarea'), preview = stage.querySelector('.preview'), stats = stage.querySelector('.stats'), verdict = stage.querySelector('.verdict');
  area.value = START;
  const update = () => {
    const text = area.value.slice(0, 20000);
    const m = scriptStats(text), runs = shortRuns(text), problems = voiceProblems(m, undefined, runs);
    let marked = escape(text);
    for (const run of runs) {
      const piece = escape(run.join(' '));
      const at = marked.indexOf(escape(run[0]));
      if (at >= 0) {
        // Wrap from the run's first sentence to its last, across the spaces between them.
        const end = marked.indexOf(escape(run.at(-1)), at) + escape(run.at(-1)).length;
        if (end > at) marked = `${marked.slice(0, at)}<mark>${marked.slice(at, end)}</mark>${marked.slice(end)}`;
        else marked = marked.replace(piece, `<mark>${piece}</mark>`);
      }
    }
    marked = marked.replace(hedgeWord, '<span class="hedge">$1</span>');
    preview.innerHTML = marked.split(/\n\s*\n/).map((p) => `<p>${p}</p>`).join('');
    const tiles = [
      [m.words, 'words'],
      [m.estimatedMinutes, 'minutes at 150 wpm'],
      [m.sentenceSpread, 'sentence-length spread'],
      [m.hedgesPer100Words, 'hedges per 100 words'],
      [m.narratorPer100Words, 'I or we per 100 words'],
      [runs.length, 'choppy runs'],
    ];
    stats.innerHTML = tiles.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    verdict.innerHTML = problems.length ? `<label>The voice gate would ask for a polish</label><ul class="gate">${problems.map((p) => `<li>${escape(p)}</li>`).join('')}</ul>` : '<p class="ok">The voice gate passes this text.</p>';
  };
  const events = new AbortController();
  area.addEventListener('input', update, { signal: events.signal });
  update();
  return () => events.abort();
}
