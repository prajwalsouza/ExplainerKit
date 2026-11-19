import {mountDataChart} from '../../runtime/src/data/index.js';
import {readInputFile} from '../../runtime/src/inputs/index.js';

const sample = (name) => new URL('./friends-sample/' + name, import.meta.url);

/** Fetch one bundled CSV within a byte and row budget, then parse it with the inputs module. */
async function rowsOf(name, maxBytes, maxRows) {
  const response = await fetch(sample(name));
  if (!response.ok || !response.body) throw Error('The Friends data could not load.');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes || chunks.length >= 4096) throw Error('The Friends sample exceeds its size limit.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const result = await readInputFile(new Blob(chunks, {type:'text/csv'}), {format:'csv', maxBytes, maxRows});
  return result.rows;
}
const count = (text) => {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid Friends turn count.');
  return value;
};

export default async function chartThemes(stage) {
  const leads = new Set(['Chandler', 'Joey', 'Monica', 'Phoebe', 'Rachel', 'Ross']);
  const totals = new Map();
  for (const {from, to, turns} of await rowsOf('friends-all-conversations.csv', 16384, 256))
    for (const id of [from, to]) totals.set(id, (totals.get(id) ?? 0) + count(turns));
  const cast = [...totals.keys()]
    .sort((a, b) => Number(leads.has(b)) - Number(leads.has(a)) || totals.get(b) - totals.get(a));
  const rows = cast.map((id) => ({
    id, value: totals.get(id), highlight: leads.has(id), group: leads.has(id) ? 'The six' : 'Around them',
  }));

  // One frame per episode. Values remember recent episodes and fade (a running memory), so a bond stays
  // visible between appearances; heat is this episode alone, so the pairs talking right now glow.
  const episodes = new Map();
  for (const {episode, from, to, turns} of await rowsOf('friends-all-episode-turns.csv', 262144, 8192)) {
    if (!totals.has(from) || !totals.has(to)) throw Error('Unknown Friends speaker.');
    if (!episodes.has(episode)) episodes.set(episode, []);
    episodes.get(episode).push([from, to, count(turns)]);
  }
  const pairMemory = new Map(), speakerMemory = new Map(cast.map((id) => [id, 0]));
  const frames = [...episodes].map(([episode, pairs]) => {
    for (const [key, value] of pairMemory) pairMemory.set(key, value * 0.82);
    for (const [id, value] of speakerMemory) speakerMemory.set(id, value * 0.8);
    const now = new Map(), spoken = new Map();
    for (const [from, to, turns] of pairs) {
      const key = from + '\u0000' + to;
      pairMemory.set(key, (pairMemory.get(key) ?? 0) + turns);
      now.set(key, turns);
      for (const id of [from, to]) spoken.set(id, (spoken.get(id) ?? 0) + turns);
    }
    for (const id of cast) speakerMemory.set(id, speakerMemory.get(id) + (spoken.get(id) ?? 0));
    return {
      label: episode,
      rows: cast.map((id) => ({
        id, value: speakerMemory.get(id), heat: Math.min(1, Math.sqrt((spoken.get(id) ?? 0) / 140)),
      })),
      links: [...pairMemory].filter(([, value]) => value >= 0.5).map(([key, value]) => {
        const [from, to] = key.split('\u0000');
        return {from, to, value, heat: Math.min(1, Math.sqrt((now.get(key) ?? 0) / 40))};
      }),
    };
  });
  const chart = await mountDataChart(stage, rows, {
    frames, frameLabel: 'Episode', frameDuration: 0.8, theme: 'silk', type: 'radial',
    label: 'Friends, episode by episode · consecutive speaker turns',
    valueLabel: 'Recent turns', linkLabel: 'Recent turns together',
  });
  const source = document.createElement('a');
  source.href = 'https://github.com/emorynlp/character-mining';
  source.textContent = 'Emory NLP Character Mining';
  const method = document.createElement('a');
  method.href = sample('README.md').href;
  method.textContent = 'method and attribution';
  const note = document.createElement('p');
  note.style.margin = '.7rem .85rem';
  note.append('Data: ', source, '. Interaction counts derived by ExplainerKit from shared scenes and consecutive speaker turns (', method, ').');
  stage.append(note);
  return () => chart.dispose();
}
