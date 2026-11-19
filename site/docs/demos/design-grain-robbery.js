import {findPhrase, highlightSchedule, layoutDocument, liftSchedule, surfaceMapper} from '../../runtime/src/typography/source/index.js';
import {css} from './_kit.js';

const CSS = `
.ek-clippings { color: var(--ink); }
.ek-clipping-window { position: relative; overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: var(--sidebar); }
.ek-clipping-scene { position: absolute; transform-origin: top left; }
.ek-crumb-paper { position: absolute; width: 278px; height: 262px; color: #312619; background: linear-gradient(105deg,#fff7dd 13%,#f6e8c5 70%,#e8d4ac); border-radius: 3px 10px 9px 4px; box-shadow: 0 10px 25px #23190836, 3px 4px #d5bd94; }
.ek-crumb-paper::before { content: ''; position: absolute; inset: 0; border: 1px solid #67492028; border-radius: inherit; pointer-events: none; }
.ek-crumb-masthead { position: absolute; inset: 19px 21px auto; padding-bottom: 7px; border-bottom: 3px double #705b42; font: 700 32px/1 Georgia,serif; text-align: center; }
.ek-crumb-copy { position: absolute; left: 23px; top: 118px; width: 226px; color: #584735; font: 16px/1.45 Georgia,serif; }
.ek-crumb-footer { position: absolute; left: 23px; right: 23px; bottom: 19px; border-top: 1px solid #705b4280; padding-top: 8px; color: #584735; font: 13px/1.4 Georgia,serif; }
.ek-crumb-paper .ek-crumb-word { position: absolute; padding: 0 3px; margin: 0; border: 0; border-radius: 1px; color: #5c2b22; background: transparent; cursor: pointer; white-space: nowrap; text-align: left; }
.ek-crumb-word span { position: relative; border-bottom: 1px dotted currentColor; }
.ek-crumb-word:focus-visible { outline: 2px solid #5c2b22; outline-offset: 1px; }
.ek-crumb-mark { position:absolute; pointer-events:none; background: #f7c956d1; transform-origin: left center; border-radius: 14% 12% 11% 3%; }
.ek-evidence-board { position: absolute; width: 243px; height: 192px; color: #312619; background: repeating-linear-gradient(-22deg,#d5b47c38 0 1px,transparent 1px 4px), #d5b47c; border: 6px solid #a17b47; border-radius: 9px; box-shadow: inset 0 2px 4px #53391b44, 0 7px 14px #23190830; text-align: center; }
.ek-evidence-board b { display: inline-block; margin-top: 20px; color: #4e3423; font: 700 11px/1.15 system-ui,sans-serif; letter-spacing: .17em; }
.ek-evidence-board::after { content: ''; position: absolute; inset: 51px 21px 28px; border: 1px dashed #77583d83; border-radius: 3px; }
.ek-evidence-pin { position: absolute; z-index: 4; display: block; width: 8px; height: 8px; border-radius: 50%; background: #a63e37; box-shadow: 1px 2px 2px #37110e66; transform: translate(-50%,-50%); pointer-events:none; }
.ek-evidence-cutout { position: absolute; z-index: 3; display: grid; place-items: center; padding: 0 8px; pointer-events: none; color: #5c2b22; background: linear-gradient(100deg,#fff5d7,#f8e9c5 87%,#ead7ac); white-space: nowrap; border-radius: 2px 5px 4px 2px; }
.ek-evidence-cutout[hidden], .ek-evidence-pin[hidden] { display:none; }
.ek-clippings p.ek-clipping-status { padding: .45rem .4rem 0; margin: 0; min-height: 3.05em; font-size: .88rem; color: var(--ink); }
`;
const paper = {width: 278, height: 262};
const choices = [
  {id: 'headline', text: 'GRAIN ROBBERY', size: 24, y: 82},
  {id: 'suspect', text: 'cereal offender', size: 22, y: 173},
];
const face = size => `700 ${size}px Georgia,serif`;
const motion = {phases: [
  {name: 'unstick', duration: .23, rise_m: .004},
  {name: 'rise', duration: .29, rise_m: .030, scale: 1.14, curl: .6},
  {name: 'travel', duration: .69, arc: .14},
  {name: 'settle', spring: {stiffness: 230, damping: 25, mass: 1}},
], secondary: {flutter: {amplitudeDeg: 7, frequency: 3.5, decay: 2}}};
const labels = {
  rest: 'The marker follows the measured rectangle around the phrase.',
  unstick: 'The letters peel away, leaving a faint print on the page.',
  rise: 'The clipping lifts and turns toward you.',
  travel: 'The clipping follows an arc to the evidence board.',
  settle: 'A damped spring settles the clipping against the board.',
  done: 'Evidence pinned. Hover or activate either phrase to see it lift again.',
};
const layoutFor = narrow => narrow
  ? {width: 323, height: 498, paperX: 22, paperY: 19, boardX: 40, boardY: 290}
  : {width: 630, height: 308, paperX: 29, paperY: 20, boardX: 354, boardY: 60};

const positions = [];
for (let row = 0; row <= 1; row++) {
  for (let col = 0; col <= 5; col++) positions.push(paper.width * col / 5000, -paper.height * row / 1000, .023 * (col / 5) ** 2);
}
const surface = surfaceMapper({size: [paper.width, paper.height], grid: [5, 1], positions});

export default async function grainRobbery(stage, ctx) {
  css('design-grain-robbery', CSS);
  stage.innerHTML = `<div class="ek-clippings"><div class="ek-clipping-window"><div class="ek-clipping-scene">
    <div class="ek-crumb-paper"><div class="ek-crumb-masthead">The Daily Crumb</div><div class="ek-crumb-copy">Police searched every cupboard. They have a lead on a</div><div class="ek-crumb-footer">The crumbs are still being dusted for prints.</div></div>
    <div class="ek-evidence-board" aria-hidden="true"><b>EVIDENCE BOARD</b></div><div class="ek-evidence-cutout" aria-hidden="true" hidden></div><i class="ek-evidence-pin" aria-hidden="true" hidden></i>
  </div></div><p class="ek-clipping-status" role="status">Hover over either underlined phrase to lift it off the paper. Tap or use Tab to lift it too.</p></div>`;
  const viewport = stage.querySelector('.ek-clipping-window');
  const scene = stage.querySelector('.ek-clipping-scene');
  const page = stage.querySelector('.ek-crumb-paper');
  const board = stage.querySelector('.ek-evidence-board');
  const chip = stage.querySelector('.ek-evidence-cutout');
  const pin = stage.querySelector('.ek-evidence-pin');
  const status = stage.querySelector('.ek-clipping-status');
  const measure = document.createElement('canvas').getContext('2d');
  await document.fonts.ready;
  const example = layoutDocument({slots: Object.fromEntries(choices.map(({id, y, size}) => [id, {size, rect: {x: 23, y, width: 232, height: 38}, maxLines: 1}]))},
    Object.fromEntries(choices.map(({id, text}) => [id, text])), {measure(text, size) {
      measure.font = face(size);
      return measure.measureText(text).width;
    }});
  const events = new AbortController();
  const on = {signal: events.signal};
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let bounds, active, request, started = 0, time = 0;
  const items = choices.map(choice => {
    const [box] = findPhrase(example, choice.text, {slot: choice.id});
    const mark = document.createElement('div');
    mark.className = 'ek-crumb-mark';
    mark.style.cssText = `left:${box.x - 3}px;top:${box.y + 4}px;width:${box.width + 8}px;height:${box.height - 5}px;transform:scaleX(0)`;
    const button = document.createElement('button');
    button.className = 'ek-crumb-word';
    button.type = 'button';
    button.setAttribute('aria-label', `Lift ${choice.text}`);
    button.style.cssText = `left:${box.x - 3}px;top:${box.y}px;height:${box.height}px;font:${face(choice.size)}`;
    const words = document.createElement('span');
    words.textContent = choice.text;
    button.append(words);
    page.append(mark, button);
    const point = surface.at(box.x + box.width / 2, box.y + box.height / 2);
    const item = {...choice, box, mark, words, point, highlight: highlightSchedule([box], {duration: .31})};
    button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') activate(item); }, on);
    button.addEventListener('focus', () => activate(item), on);
    button.addEventListener('click', () => activate(item), on);
    return item;
  });

  function makePlan(item) {
    const {paperX, paperY, boardX, boardY} = bounds;
    return liftSchedule(motion, {at: item.highlight.end + .06,
      from: {x: paperX / 1000 + item.point.x, y: -paperY / 1000 + item.point.y, z: item.point.z},
      to: {x: (boardX + 121.5) / 1000, y: -(boardY + 103) / 1000, z: 0}, finalScale: .89});
  }

  function paint() {
    const pose = active.plan.pose(time);
    const [marker] = active.item.highlight.at(time);
    for (const item of items) {
      const selected = item === active.item;
      item.mark.style.transform = `scaleX(${selected ? marker.drawn : 0})`;
      item.words.style.opacity = selected ? String(pose.imprint) : '1';
    }
    chip.hidden = pose.phase === 'rest';
    pin.hidden = pose.phase !== 'settle' && pose.phase !== 'done';
    const tilt = Math.atan2(-active.item.point.normal.x, active.item.point.normal.z) * 180 / Math.PI;
    const x = 1000 * pose.position.x, y = -1000 * pose.position.y;
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    chip.style.transform = `translate(-50%,-50%) perspective(260px) rotateY(${tilt * (1 - pose.faceCamera)}deg) rotate(${pose.flutterDeg}deg) scale(${pose.scale})`;
    chip.style.boxShadow = `${pose.curl * 4}px ${4 + pose.shadow * 11}px ${2 + pose.shadow * 18}px rgb(36 24 15 / ${.56 * pose.shadow})`;
    pin.style.left = `${bounds.boardX + 121.5}px`;
    pin.style.top = `${bounds.boardY + 87}px`;
    if (status.textContent !== labels[pose.phase]) status.textContent = labels[pose.phase];
  }

  function tick(now) {
    request = undefined;
    const end = active.plan.phases.done;
    time = Math.min(end, (now - started) / 1000);
    paint();
    if (time < end) request = requestAnimationFrame(tick);
  }

  function activate(item) {
    if (!bounds || (active?.item === item && request !== undefined)) return;
    cancelAnimationFrame(request);
    request = undefined;
    active = {item, plan: makePlan(item)};
    chip.textContent = item.text;
    chip.style.font = face(item.size);
    chip.style.height = `${item.box.height + 7}px`;
    time = ctx.still || preference.matches ? active.plan.phases.done : 0;
    paint();
    if (time === 0) {
      started = performance.now();
      request = requestAnimationFrame(tick);
    }
  }

  function fit() {
    const width = viewport.clientWidth;
    if (!width) return;
    bounds = layoutFor(width < 510);
    const scale = Math.min(1.38, width / bounds.width);
    viewport.style.height = `${Math.round(bounds.height * scale)}px`;
    scene.style.left = `${(width - bounds.width * scale) / 2}px`;
    scene.style.transform = `scale(${scale})`;
    page.style.left = `${bounds.paperX}px`;
    page.style.top = `${bounds.paperY}px`;
    board.style.left = `${bounds.boardX}px`;
    board.style.top = `${bounds.boardY}px`;
    if (active) {
      active.plan = makePlan(active.item);
      paint();
    }
  }

  const size = new ResizeObserver(fit);
  size.observe(stage);
  preference.addEventListener('change', () => {
    if (!active || !preference.matches) return;
    cancelAnimationFrame(request);
    request = undefined;
    time = active.plan.phases.done;
    paint();
  }, on);
  fit();
  return () => { events.abort(); size.disconnect(); cancelAnimationFrame(request); };
}
