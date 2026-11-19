import {hsla, toHex} from '../../runtime/src/color/index.js';
import {css, ink} from './_kit.js';

export const WIDTH = 520;
export const paintColor = (h, s, l, a = 1) => toHex(hsla(h, s, l, a));
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const CSS = `
.ek-study { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); }
.ek-study-picture { position: relative; }
.ek-study-picture canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 15px 15px 0 0; }
.ek-study-picture .ek-study-handle {
  position: absolute; width: 34px; height: 34px; padding: 0; border: 0;
  border-radius: 50%; background: transparent; transform: translate(-50%, -50%);
  cursor: grab; touch-action: none;
}
.ek-study-picture .ek-study-handle:active { cursor: grabbing; }
.ek-study-picture .ek-study-handle:focus-visible { outline-offset: 2px; border-radius: 50%; }
.ek-study-status { margin: 0; padding: .48rem 1rem .85rem; min-height: 3em; color: var(--ink); font-size: .875rem; }
`;

export function disc(g, x, y, radius, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, radius, 0, 2 * Math.PI);
  g.fill();
}

export function polygon(g, points, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (const {x, y} of points.slice(1)) g.lineTo(x, y);
  g.closePath();
  g.fill();
}

export function label(g, text, x, y, fill, size = 19) {
  g.font = `600 ${size}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

// The drawing and its touch targets use the same fixed coordinate system.
// No work is scheduled between reader input, a resize, and a theme change.
export function dragStudy(stage, ctx, {height = 300, handles, draw}) {
  css('design-stage', CSS);
  stage.innerHTML = '<div class="ek-study"><div class="ek-study-picture"><canvas aria-hidden="true"></canvas></div><p class="ek-study-status" role="status"></p></div>';
  const picture = stage.querySelector('.ek-study-picture');
  const canvas = picture.querySelector('canvas');
  const g = canvas.getContext('2d');
  const status = stage.querySelector('.ek-study-status');
  picture.style.aspectRatio = `${WIDTH} / ${height}`;
  const events = new AbortController();
  const on = {signal: events.signal};
  const keys = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
  let drag = null;
  const controls = handles.map(handle => {
    const button = document.createElement('button');
    button.className = 'ek-study-handle';
    button.type = 'button';
    button.setAttribute('aria-label', `Move ${handle.name} with the arrow keys`);
    picture.append(button);
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      const start = local(event);
      drag = {id: event.pointerId, button, dx: handle.x - start.x, dy: handle.y - start.y};
      button.setPointerCapture(event.pointerId);
    }, on);
    button.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      const point = local(event);
      move(handle, point.x + drag.dx, point.y + drag.dy);
    }, on);
    button.addEventListener('lostpointercapture', () => { if (drag?.button === button) drag = null; }, on);
    button.addEventListener('keydown', event => {
      const direction = keys[event.key];
      if (!direction || drag) return;
      if (handle.axis === 'x' && !direction[0]) return;
      if (handle.axis === 'y' && !direction[1]) return;
      event.preventDefault();
      move(handle, handle.x + 12 * direction[0], handle.y + 12 * direction[1]);
    }, on);
    return button;
  });

  function local(event) {
    const bounds = picture.getBoundingClientRect();
    return {x: (event.clientX - bounds.x) * WIDTH / bounds.width, y: (event.clientY - bounds.y) * height / bounds.height};
  }

  function move(handle, x, y) {
    if (handle.axis !== 'y') handle.x = clamp(x, handle.minX ?? 18, handle.maxX ?? WIDTH - 18);
    if (handle.axis !== 'x') handle.y = clamp(y, handle.minY ?? 18, handle.maxY ?? height - 18);
    redraw();
  }

  function redraw() {
    g.clearRect(0, 0, WIDTH, height);
    const message = draw(g, {width: WIDTH, height, dark: ctx.dark(), ink: ink(ctx)});
    if (status.textContent !== message) status.textContent = message;
    controls.forEach((button, index) => {
      button.style.left = `${100 * handles[index].x / WIDTH}%`;
      button.style.top = `${100 * handles[index].y / height}%`;
    });
  }

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(picture.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(picture.clientHeight * dpr));
    g.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / height, 0, 0);
    redraw();
  }

  const resize = new ResizeObserver(fit);
  resize.observe(picture);
  const offTheme = ctx.onTheme(redraw);
  fit();
  return () => {
    if (drag?.button.hasPointerCapture(drag.id)) drag.button.releasePointerCapture(drag.id);
    events.abort();
    resize.disconnect();
    offTheme();
  };
}
