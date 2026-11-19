import {buildProject, createProject, parseProject} from '../../runtime/src/project/index.js';
import {createSVGRenderer} from '../../runtime/src/renderers/svg.js';
import {css} from './_kit.js';
import {paintColor} from './design-stage.js';

const CSS = `
.ek-potato { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); padding: clamp(10px, 3cqw, 24px); color: var(--ink); }
.ek-potato-portraits { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 4%; }
.ek-potato-photo { padding: 6%; border-radius: 5px; background: var(--paper); }
.ek-potato-photo svg { display: block; width: 100%; height: auto; aspect-ratio: 240 / 172; background: var(--photo); }
.ek-potato-photo p { margin: .5em 0 0; text-align: center; font-size: .875rem; font-weight: 650; }
.ek-potato-paperwork { display: flex; flex-wrap: wrap; justify-content: center; gap: .45rem; margin: .9rem 0 0; }
.ek-potato-paperwork button, .ek-potato-props button { font: inherit; font-size: .875rem; cursor: pointer; color: var(--ink); }
.ek-potato-paperwork button { border: 1px solid var(--line); border-radius: 6px; padding: .35em .65em; background: var(--paper); }
.ek-potato-paperwork button:disabled { opacity: .42; cursor: default; }
.ek-potato-props { display: flex; flex-wrap: wrap; justify-content: center; gap: .55rem; margin: .85rem 0 0; }
.ek-potato-props button { display: flex; align-items: center; gap: .45em; min-height: 40px; padding: .35em .65em; background: transparent; border: 1px solid transparent; border-radius: 999px; }
.ek-potato-props button[aria-pressed=true] { background: var(--paper); border-color: var(--line); }
.ek-potato-props i { display: block; background: var(--nose); border-radius: 65% 48% 55% 50%; width: 1em; height: 1em; }
.ek-potato-props .long i { width: .65em; height: 1.2em; }
.ek-potato-props .wide i { width: 1.3em; height: .68em; }
.ek-potato p[role=status] { margin: .75rem 0 0; font-size: .875rem; }
`;

const disguises = {
  round: {rx: 12, ry: 11, name: 'round'},
  long: {rx: 7, ry: 19, name: 'long'},
  wide: {rx: 22, ry: 8, name: 'wide'},
};

function initialRecipe() {
  const potato = paintColor(33, 54, 55);
  const nose = paintColor(16, 61, 56);
  const pupil = paintColor(24, 27, 19);
  const glint = paintColor(43, 80, 90);
  const freckle = paintColor(28, 44, 38, .62);
  const ellipse = (id, x, y, rx, ry, fill) => ({id, type: 'circle', props: {x, y, r: 1, scaleX: rx, scaleY: ry, fill}});
  return {
    format: 'explainerkit-project', version: 1,
    scene: {width: 240, height: 172},
    nodes: [
      ellipse('shadow', 122, 154, 54, 10, paintColor(28, 26, 34, .25)),
      ellipse('spud', 121, 85, 47, 64, potato),
      ellipse('cheek-shade', 136, 102, 24, 32, paintColor(29, 49, 39, .19)),
      ellipse('freckle-a', 91, 54, 2, 3, freckle),
      ellipse('freckle-b', 98, 118, 2, 3, freckle),
      ellipse('freckle-c', 141, 123, 3, 2, freckle),
      ellipse('freckle-d', 141, 44, 2, 3, freckle),
      ellipse('freckle-e', 138, 46, 1.5, 1.5, freckle),
      ellipse('left-eye', 105, 74, 5, 7, pupil),
      ellipse('right-eye', 135, 74, 5, 7, pupil),
      ellipse('left-glint', 106, 71, 1.5, 1.5, glint),
      ellipse('right-glint', 136, 71, 1.5, 1.5, glint),
      ellipse('mouth', 118, 121, 4.5, 3, pupil),
      ellipse('nose', 120, 96, disguises.round.rx, disguises.round.ry, nose),
    ],
  };
}

export default function potatoProject(stage, ctx) {
  css('design-project-potato', CSS);
  stage.innerHTML = `<div class="ek-potato">
    <div class="ek-potato-portraits">
      <div class="ek-potato-photo"><div data-current></div><p>Current disguise</p></div>
      <div class="ek-potato-photo"><div data-filed></div><p>Last filed disguise</p></div>
    </div>
    <div class="ek-potato-props" role="group" aria-label="Choose a disguise nose">
      <button class="round" data-disguise="round" type="button"><i aria-hidden="true"></i>Round</button>
      <button class="long" data-disguise="long" type="button"><i aria-hidden="true"></i>Long</button>
      <button class="wide" data-disguise="wide" type="button"><i aria-hidden="true"></i>Wide</button>
    </div>
    <div class="ek-potato-paperwork">
      <button data-undo type="button">Undo</button><button data-redo type="button">Redo</button>
      <button data-file type="button">File disguise</button>
    </div>
    <p role="status"></p>
  </div>`;
  const card = stage.querySelector('.ek-potato');
  const controls = new AbortController();
  const events = {signal: controls.signal};
  const project = createProject(initialRecipe(), {historyLimit: 12});
  const current = createSVGRenderer(card.querySelector('[data-current]'), {label: 'Current potato disguise'});
  const filed = createSVGRenderer(card.querySelector('[data-filed]'), {label: 'Potato disguise rebuilt from saved JSON'});
  const status = card.querySelector('[role=status]');
  const undo = card.querySelector('[data-undo]');
  const redo = card.querySelector('[data-redo]');
  const propsButtons = [...card.querySelectorAll('[data-disguise]')];
  const noseProps = () => project.snapshot.nodes.find(({id}) => id === 'nose').props;
  let saved = project.serialize();

  function render(message) {
    current.render(project.build().scene.sample({time: 0}));
    undo.disabled = !project.canUndo;
    redo.disabled = !project.canRedo;
    for (const button of propsButtons) {
      button.setAttribute('aria-pressed', String(noseProps().scaleX === disguises[button.dataset.disguise].rx));
    }
    status.textContent = message;
  }

  function openFile() {
    filed.render(buildProject(parseProject(saved)).scene.sample({time: 0}));
  }

  function theme() {
    card.style.setProperty('--paper', paintColor(37, 26, ctx.dark() ? 23 : 94));
    card.style.setProperty('--photo', paintColor(164, 30, ctx.dark() ? 29 : 78));
    card.style.setProperty('--nose', paintColor(16, 61, ctx.dark() ? 64 : 56));
  }

  for (const button of propsButtons) {
    button.addEventListener('click', () => {
      const {rx, ry, name} = disguises[button.dataset.disguise];
      if (noseProps().scaleX === rx) return;
      project.edit(draft => Object.assign(draft.nodes.find(({id}) => id === 'nose').props, {scaleX: rx, scaleY: ry}));
      render(`The potato went incognitater with a ${name} nose. This edit is in the project history.`);
    }, events);
  }
  undo.addEventListener('click', () => { if (project.undo()) render('Undid one disguise change.'); }, events);
  redo.addEventListener('click', () => { if (project.redo()) render('Restored one disguise change.'); }, events);
  card.querySelector('[data-file]').addEventListener('click', () => {
    saved = project.serialize();
    openFile();
    status.textContent = 'Filed. The portrait on the right was rebuilt from the saved JSON.';
  }, events);

  const offTheme = ctx.onTheme(theme);
  theme();
  openFile();
  render('The potato needs a disguise. Pick a nose, then file the new portrait.');
  return () => {
    controls.abort();
    offTheme();
    current.dispose();
    filed.dispose();
  };
}
