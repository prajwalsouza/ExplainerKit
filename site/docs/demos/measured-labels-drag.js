import {canvasTextMeasurer, placeLabels} from '../../runtime/src/layout/labels.js';
import {hsla, toHex} from '../../runtime/src/color/index.js';
import {css, ink} from './_kit.js';

const CSS = `
.mld-stage { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.mld-chart { position: relative; height: 320px; }
.mld-chart canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 15px 15px 0 0; }
.mld-chart .mld-point {
  position: absolute; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; transform: translate(-50%, -50%); cursor: grab; touch-action: none;
}
.mld-chart .mld-moon { width: 56px; height: 56px; }
.mld-chart .mld-point:active { cursor: grabbing; }
.mld-chart .mld-point:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.mld-status { margin: 0; padding: 0 1.25rem 1rem; min-height: 3.9em; color: var(--ink); font-size: .875rem; }
@media (max-width: 500px) { .mld-chart { height: 360px; } }
`;
const STARS = [
  ['Deneb', .58, .14, 1.25], ['Sadr', .52, .34, .9], ['Gienah', .70, .36, .75],
  ['Fawaris', .36, .28, .7], ['Albireo', .40, .72, .8], ['Vega', .17, .22, 1.35],
  ['Sheliak', .20, .50, .6], ['Altair', .84, .70, 1.2], ['Tarazed', .80, .58, .65],
];
const LINES = [
  ['Deneb', 'Sadr'], ['Sadr', 'Albireo'], ['Gienah', 'Sadr'], ['Sadr', 'Fawaris'],
  ['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega'], ['Vega', 'Sheliak'], ['Altair', 'Tarazed'],
];
const MOON = 'Moon';
const FONT = '500 14px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
const GAP = 6;
const MOON_RADIUS = 28;
const IDLE = 'The dashed square is the Moon’s obstacle box.';
const shade = (h, s, l, a = 1) => toHex(hsla(((h % 360) + 360) % 360, s, l, a));

export default async function measuredLabelsDrag(stage, ctx) {
  css('measured-labels-drag', CSS);
  stage.classList.add('mld-stage');
  stage.innerHTML = `<div class="mld-chart"><canvas aria-hidden="true"></canvas></div><p class="mld-status" role="status">${IDLE}</p>`;
  const chart = stage.querySelector('.mld-chart');
  const canvas = chart.querySelector('canvas');
  const g = canvas.getContext('2d');
  const status = stage.querySelector('.mld-status');
  await document.fonts.ready;
  const measure = canvasTextMeasurer(g, {font: FONT, lineHeight: 20});
  const initial = new Map([...STARS, [MOON, .30, .58]].map(([id, x, y]) => [id, {x, y}]));
  const controls = new Map();
  const events = new AbortController();
  const on = {signal: events.signal};
  let positions = initial;
  let anchors, boxes, width, height;
  let selected = null;
  let rejected = null;
  let drag = null;

  function say(message) {
    if (status.textContent !== message) status.textContent = message;
  }

  function moonBox({x, y}) {
    return {x: x - MOON_RADIUS, y: y - MOON_RADIUS, width: 2 * MOON_RADIUS, height: 2 * MOON_RADIUS};
  }

  function plan(next) {
    const points = new Map([...next].map(([id, {x, y}]) => [id, {x: x * width, y: y * height}]));
    const labels = STARS.map(([id]) => ({id, text: id, anchor: points.get(id)}));
    const layout = placeLabels(labels, {
      bounds: {x: 10, y: 10, width: width - 20, height: height - 20},
      obstacles: [moonBox(points.get(MOON))],
      measure,
      gap: GAP,
    });
    positions = next;
    anchors = points;
    boxes = layout;
  }

  function strokeRect({x, y, width, height}, color, dash = []) {
    g.strokeStyle = color;
    g.setLineDash(dash);
    g.strokeRect(x, y, width, height);
    g.setLineDash([]);
  }

  function disc({x, y}, radius, fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(x, y, radius, 0, 2 * Math.PI);
    g.fill();
  }

  function drawMoon(moon, dark) {
    const {x, y} = moon;
    const glow = g.createRadialGradient(x - 9, y - 10, 2, x, y, MOON_RADIUS);
    glow.addColorStop(0, shade(45, 90, 96));
    glow.addColorStop(1, shade(40, 59, dark ? 68 : 78));
    disc(moon, MOON_RADIUS, glow);
    disc({x: x - 16, y: y + 9}, 5, shade(39, 47, 56, .23));
    disc({x: x + 14, y: y - 14}, 4, shade(39, 47, 56, .23));

    const nearest = STARS.map(([id]) => anchors.get(id)).reduce((a, b) => (
      Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b
    ));
    const distance = Math.max(20, Math.hypot(nearest.x - x, nearest.y - y));
    const face = shade(34, 37, 23);
    for (const eye of [x - 7, x + 7]) {
      disc({x: eye, y: y - 4}, 4, shade(46, 80, 98));
      disc({x: eye + 1.6 * (nearest.x - x) / distance, y: y - 4 + 1.6 * (nearest.y - y) / distance}, 2, face);
    }
    if (rejected?.id === MOON) {
      disc({x, y: y + 8}, 3, face);
    } else {
      g.strokeStyle = face;
      g.beginPath();
      g.moveTo(x - 5, y + 6);
      g.quadraticCurveTo(x, y + 14, x + 5, y + 6);
      g.stroke();
    }
  }

  function paint() {
    if (!anchors) return;
    const dark = ctx.dark();
    const accent = shade(ctx.hue, 60, dark ? 76 : 36);
    const faint = shade(ctx.hue, 28, dark ? 72 : 35, .33);
    g.clearRect(0, 0, width, height);
    const sky = g.createLinearGradient(0, 0, width * .75, height);
    sky.addColorStop(0, shade(ctx.hue - 28, 55, dark ? 29 : 88, .23));
    sky.addColorStop(1, shade(ctx.hue + 18, 55, dark ? 24 : 93, 0));
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);
    g.lineWidth = 1;
    g.strokeStyle = faint;
    g.beginPath();
    for (const [from, to] of LINES) {
      const a = anchors.get(from), b = anchors.get(to);
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
    }
    g.stroke();

    const moon = anchors.get(MOON);
    drawMoon(moon, dark);
    strokeRect(moonBox(moon), selected === MOON ? accent : faint, [4, 3]);

    STARS.forEach(([id, , , magnitude], index) => {
      const point = anchors.get(id);
      const hue = ctx.hue - 30 + 12 * index;
      if (selected === id) disc(point, 9, shade(hue, 70, dark ? 70 : 45, .24));
      disc(point, 2.5 + magnitude * 1.4, shade(hue, 60, dark ? 81 : 42));
    });

    g.font = FONT;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    for (const box of boxes) {
      if (box.id === selected) strokeRect(box, accent);
      g.fillStyle = ink(ctx);
      g.fillText(box.text, box.x, box.y + box.height / 2);
    }
    if (rejected) {
      const {x, y} = rejected.point;
      const outline = rejected.id === MOON ? moonBox({x, y}) : {x: x - 5, y: y - 5, width: 10, height: 10};
      strokeRect(outline, shade(12, 75, dark ? 72 : 37), [3, 2]);
    }
    for (const [id, control] of controls) {
      const point = anchors.get(id);
      control.style.left = `${point.x}px`;
      control.style.top = `${point.y}px`;
    }
  }

  function describe(id) {
    if (id === MOON) {
      say('The labels keep their gap from the Moon’s dashed square.');
      return;
    }
    const {x, y} = anchors.get(id);
    const box = boxes.find((label) => label.id === id);
    const horizontal = box.x > x ? 'right' : box.x + box.width < x ? 'left' : '';
    const vertical = box.y > y ? 'below' : box.y + box.height < y ? 'above' : '';
    const position = [vertical, horizontal].filter(Boolean).join(' and ');
    say(`${id}’s label fits ${position}.`);
  }

  function move(id, x, y) {
    const inset = id === MOON ? MOON_RADIUS + 10 : 16;
    const point = {
      x: Math.max(inset, Math.min(width - inset, x)),
      y: Math.max(inset, Math.min(height - inset, y)),
    };
    const next = new Map(positions);
    next.set(id, {x: point.x / width, y: point.y / height});
    try {
      plan(next);
      rejected = null;
      describe(id);
    } catch (error) {
      if (error.code !== 'LABEL_LAYOUT_OVERFLOW') throw error;
      rejected = {id, point};
      say(id === MOON
        ? 'Eclipse denied. A star’s label ran out of room, so the Moon stays put.'
        : 'That star needs more space. The dashed outline marks the rejected move.');
    }
    paint();
  }

  function fit() {
    width = chart.clientWidth;
    height = chart.clientHeight;
    if (width <= 20 || height <= 20) return;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    g.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    const wasRejected = rejected !== null;
    rejected = null;
    try {
      plan(positions);
      if (wasRejected && selected) describe(selected);
    } catch (error) {
      if (error.code !== 'LABEL_LAYOUT_OVERFLOW') throw error;
      plan(initial);
      say('The chart returned to its starting layout to fit the new width.');
    }
    paint();
  }

  function select(id) {
    selected = id;
    rejected = null;
    describe(id);
    paint();
  }

  const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
  for (const id of initial.keys()) {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = id === MOON ? 'mld-point mld-moon' : 'mld-point';
    control.setAttribute('aria-label', `Move ${id === MOON ? 'the Moon' : id} with the arrow keys`);
    controls.set(id, control);
    chart.append(control);
    control.addEventListener('focus', () => select(id), on);
    control.addEventListener('click', (event) => { if (event.detail === 0) select(id); }, on);
    control.addEventListener('keydown', (event) => {
      const direction = directions[event.key];
      if (!direction || drag) return;
      event.preventDefault();
      selected = id;
      const {x, y} = anchors.get(id);
      move(id, x + direction[0] * 12, y + direction[1] * 12);
    }, on);
    control.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || drag) return;
      const {x, y} = anchors.get(id);
      drag = {control, pointerId: event.pointerId, dx: x - event.clientX, dy: y - event.clientY};
      control.setPointerCapture(event.pointerId);
      select(id);
    }, on);
    control.addEventListener('pointermove', (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      move(id, event.clientX + drag.dx, event.clientY + drag.dy);
    }, on);
    control.addEventListener('lostpointercapture', () => { if (drag?.control === control) drag = null; }, on);
  }

  const resize = new ResizeObserver(fit);
  resize.observe(chart);
  const offTheme = ctx.onTheme(paint);
  fit();
  return () => {
    if (drag?.control.hasPointerCapture(drag.pointerId)) drag.control.releasePointerCapture(drag.pointerId);
    events.abort();
    resize.disconnect();
    offTheme();
  };
}
