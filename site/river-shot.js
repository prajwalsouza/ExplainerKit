// The River chapter: a velocity field measured from footage, and things that ride it.
//
// The room's last frame is the pillar that crosses the shot. It slides away and the river is behind it. What moves
// on the river is measured from the river: landing-two's tools/measure-river.mjs ran `measureFlow` from
// explainerkit/vfx over the clip and saved a grid of small windows, each with the motion of the picture there in
// pixels a second. The page loads it with `compileFlow`. Arrows show the field, `flowStreaks` rides it with
// streaks that grow longer where the water is faster, and `traceFlow` works out where a paper boat set down at a
// point will be carried. The clip gives no surveyed length, so speeds are relative to the clip's own median.
//
// The chapter closes as a circle that shrinks onto the middle of the screen, where the story's point is waiting.
import { hsla } from 'explainerkit/color';
import { randomAt } from 'explainerkit/noise';
import { compileFlow, flowStreaks, sampleFlow, traceFlow } from 'explainerkit/vfx';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const v = clamp((x - a) / (b - a));return v * v * (3 - 2 * v); };
const mix = (a, b, t) => a + (b - a) * t;
const asset = (extension) => new URL(`./media/river.${extension}`, import.meta.url);
// H.264 where it plays (Safari, and many iPhones that cannot play VP9), else the WebM.
const FOOTAGE = document.createElement('video').canPlayType('video/mp4; codecs="avc1.640029"') ? 'mp4' : 'webm';
// The part of the picture to keep in view on a tall screen, and where the page's boats set off, in field pixels.
const FOCUS = { x: 300, y: 190 }, SOURCE = { x: 60, y: 40, width: 210, height: 120 };
// The tree trunk that stands in the stream, in field pixels: the returning paper planes steer round it.
const TRUNK = { x0: 262, x1: 366, y0: 0, y1: 150 };
// Where in the chapter the measured flow gives way to the flock.
const HANDOVER = [.54, .64];

export function createRiverShot(host, credit) {
  const sheet = Object.assign(document.createElement('canvas'), { className: 'river-sheet' }), pen = sheet.getContext('2d');
  // Kept rendered, tiny and nearly transparent: iOS Safari may not decode frames for a video that is not.
  const video = Object.assign(document.createElement('video'), { muted: true, playsInline: true, loop: true, preload: 'auto', className: 'footage-source' });
  const shade = document.createElement('div');shade.className = 'footage-shade';
  host.append(sheet, shade);
  // The host is hidden outside the chapter, so the video lives on the page body, where it stays rendered.
  document.body.append(video);
  const controls = document.createElement('div');
  controls.className = 'footage-controls';controls.hidden = true;controls.setAttribute('role', 'group');controls.setAttribute('aria-label', 'River footage');
  controls.innerHTML = '<button class="footage-play" type="button" aria-label="Pause footage" title="Pause footage"></button><input type="range" min="0" step="1" value="0" aria-label="Footage position">';
  document.body.append(controls);
  const button = controls.querySelector('button'), scrubber = controls.querySelector('input');
  // The reader's choice to pause holds until they press play again or leave the chapter.
  let held = false;
  const sync = () => { const label = video.paused ? 'Play footage' : 'Pause footage';button.setAttribute('aria-label', label);button.title = label;button.toggleAttribute('data-playing', !video.paused); };
  for (const event of ['play', 'pause']) video.addEventListener(event, sync);
  button.addEventListener('click', () => { if (video.paused) { held = false;void video.play().catch(sync); } else { held = true;video.pause(); } });
  scrubber.addEventListener('input', () => { held = true;video.pause();video.currentTime = (scrubber.valueAsNumber + .5) / 25; });
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let field = null, streaks = null, failed = false, active = false, lastTime = null, pointer = null, clock = 0, view = null, moving = [], springs = [];
  fetch(asset('json')).then((r) => (r.ok ? r.json() : Promise.reject(Error('no measurement')))).then((json) => {
    field = compileFlow(json);
    streaks = flowStreaks(field, { count: 560, seed: 7, life: 2.2, tail: .13 });
    field.state.forEach((state, k) => { if (state === 2) moving.push(k); });
    const at = (k) => ({ x: field.grid.x + (k % field.grid.cols) * field.grid.step, y: field.grid.y + Math.floor(k / field.grid.cols) * field.grid.step });
    springs = moving.filter((k) => { const p = at(k);return p.x >= SOURCE.x && p.x <= SOURCE.x + SOURCE.width && p.y >= SOURCE.y && p.y <= SOURCE.y + SOURCE.height; });
  }).catch(() => { failed = true; });
  video.addEventListener('error', () => { failed = true; });
  video.src = asset(FOOTAGE).href;

  const cellPoint = (k, n, c) => ({ x: field.grid.x + (k % field.grid.cols) * field.grid.step + (randomAt(83, n, c) - .5) * field.grid.step, y: field.grid.y + Math.floor(k / field.grid.cols) * field.grid.step + (randomAt(83, n, c + 1) - .5) * field.grid.step });
  /** The nearest place on moving water to a point of the picture, or null if none is within `within` pixels. */
  function nearestMoving(p, within) {
    if (Math.hypot(...Object.values(sampleFlow(field, p.x, p.y))) >= 10) return p;
    let best = within, found = null;
    for (const k of moving) { const x = field.grid.x + (k % field.grid.cols) * field.grid.step, y = field.grid.y + Math.floor(k / field.grid.cols) * field.grid.step, d = Math.hypot(x - p.x, y - p.y);if (d < best) { best = d;found = { x, y }; } }
    return found;
  }
  const riders = [];
  let nextBoat = 0, boats = 0;
  function launch(start, kind) { riders.push({ path: traceFlow(field, start, { duration: 14 }), born: clock, kind, hue: kind === 'boat' ? [44, 8, 214][boats % 3] : 0 });if (riders.length > 18) riders.shift(); }
  const tone = (speed, alpha = 1) => { const t = clamp(speed / field.speed.fast);return hsla(mix(216, 192, t), mix(88, 96, t), mix(50, 80, t), alpha); };

  function tap(clientX, clientY) {
    if (!view || !active) return false;
    const p = nearestMoving(view.toField(clientX, clientY), 70);if (!p) return false;
    launch(p, 'boat');boats++;return true;
  }
  host.addEventListener('pointerdown', (event) => { if (tap(event.clientX, event.clientY)) event.preventDefault(); });
  host.addEventListener('pointermove', (event) => { pointer = { x: event.clientX, y: event.clientY }; });
  host.addEventListener('pointerleave', () => { pointer = null; });

  function paintBoat(x, y, size, turn, hue) {
    pen.save();pen.translate(x, y + Math.sin(clock * 5 + x) * .8);pen.rotate(turn);
    pen.fillStyle = hsla(218, 60, 14, .32);pen.beginPath();pen.ellipse(-size * .1, size * .34, size * 1.1, size * .42, 0, 0, 6.2832);pen.fill();
    const light = hue === 44 ? [44, 46, 97] : hue === 8 ? [8, 70, 58] : [214, 74, 58], dark = [light[0], light[1] * .8, light[2] - 12];
    pen.fillStyle = hsla(...light);pen.strokeStyle = hsla(30, 22, 24, .7);pen.lineWidth = .9;
    pen.beginPath();pen.moveTo(-size * 1.15, -size * .12);pen.lineTo(size * 1.3, -size * .12);pen.lineTo(size * .62, size * .5);pen.lineTo(-size * .6, size * .5);pen.closePath();pen.fill();pen.stroke();
    pen.fillStyle = hsla(...dark);pen.beginPath();pen.moveTo(-size * .5, -size * .12);pen.lineTo(size * .08, -size * .95);pen.lineTo(size * .6, -size * .12);pen.closePath();pen.fill();pen.stroke();
    pen.restore();
  }

  return {
    get ready() { return !!field && video.readyState >= 2; },
    get failed() { return failed; },
    /** The footage is on its way but has no frame yet: iOS in Low Power Mode waits for a tap before loading it. */
    get waiting() { return !!field && !failed && !!video.src && video.readyState < 2; },
    /** Start loading from a tap. The river plays as soon as its chapter is showing, so it pauses only when hidden. */
    unlock() {
      if (failed || !video.src || video.readyState >= 2) return;
      const started = video.play();
      started?.then(() => { if (!active) video.pause(); }).catch(() => {});
    },
    get video() { return { src: video.currentSrc.split('/').pop(), readyState: video.readyState, networkState: video.networkState, error: video.error?.code ?? null, paused: video.paused, failed, field: !!field }; },
    /** The trunk on screen now, in CSS pixels: its left and right edges at mid-height, or null when not shown. */
    trunk() { if (!view || !active) return null;const a = view.toScreen(TRUNK.x0, (TRUNK.y0 + TRUNK.y1) / 2), b = view.toScreen(TRUNK.x1, (TRUNK.y0 + TRUNK.y1) / 2);return { x0: a[0], x1: b[0], y: a[1] }; },
    get status() { return { ready: this.ready, playing: !video.paused, riders: riders.length, windows: moving.length, speed: field?.speed }; },
    /**
     * `u` runs from 0 to 1 through the chapter. `wipe` lists the colours of the pillar the shot opens from, top to bottom, and
     * `point` the screen place of the story's point, where the circle closes at the end.
     */
    project(u, time, { wipe, point }) {
      const was = active;active = u > 0 && u < 1 && !failed && this.ready;
      if (!active) {
        host.hidden = true;credit.hidden = true;controls.hidden = true;host.style.pointerEvents = 'none';
        if (was) { video.pause();riders.length = 0;held = false; }
        lastTime = null;return 0;
      }
      if (!was) { if (!still.matches && !held) void video.play().catch(sync);nextBoat = clock + .4; }
      controls.hidden = !(u > .18 && u < .84);
      if (!controls.hidden) {
        const frames = Math.max(2, Math.round((video.duration || 8) * 25)), at = Math.round(video.currentTime * 25);
        scrubber.max = frames - 1;scrubber.value = at;scrubber.style.setProperty('--played', `${100 * at / (frames - 1)}%`);
        const width = Math.min(innerWidth - 36, 300), chip = document.querySelector('.chip')?.getBoundingClientRect(), small = innerWidth < 700;
        const left = small ? 18 : innerWidth - 64 - width, clash = chip && chip.width && chip.right > left - 8, top = (clash ? chip.top - 40 : innerHeight - 30) - 58;
        controls.style.cssText = `left:${left}px;top:${Math.round(top)}px;width:${width}px`;
      }
      host.hidden = false;credit.hidden = !(u > .16 && u < .86);host.style.pointerEvents = u > .15 && u < HANDOVER[0] ? 'auto' : 'none';
      const dt = lastTime === null ? 0 : Math.min(.1, Math.max(0, time - lastTime));lastTime = time;
      if (!(still.matches && video.paused)) clock += dt;
      const ratio = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
      if (sheet.width !== Math.round(w * ratio) || sheet.height !== Math.round(h * ratio)) { sheet.width = Math.round(w * ratio);sheet.height = Math.round(h * ratio); }
      pen.setTransform(ratio, 0, 0, ratio, 0, 0);pen.clearRect(0, 0, w, h);

      const scale = Math.max(w / field.width, h / field.height), fw = field.width * scale, fh = field.height * scale;
      const fx = clamp(w / 2 - FOCUS.x * scale, w - fw, 0), fy = clamp(h / 2 - FOCUS.y * scale, h - fh, 0);
      const onto = (x, y) => [fx + x * scale, fy + y * scale];
      view = { toField: (px, py) => ({ x: (px - fx) / scale, y: (py - fy) / scale }), toScreen: onto };

      // The close: a circle that shrinks onto the story's point.
      const close = smooth(.84, 1, u), reach = Math.hypot(Math.max(point.x, w - point.x), Math.max(point.y, h - point.y)) * 1.04;
      const radius = mix(reach, 0, close * (2 - close));
      pen.save();
      if (close > 0) { pen.beginPath();pen.arc(point.x, point.y, Math.max(0, radius), 0, 6.2832);pen.clip(); }
      pen.drawImage(video, fx, fy, fw, fh);
      pen.lineCap = pen.lineJoin = 'round';
      const { grid } = field, thick = Math.sqrt(scale);

      // Boats leave from the top of the falls while the chapter plays, one every few seconds.
      if (clock > nextBoat && springs.length && u > .12 && u < HANDOVER[0]) { launch(cellPoint(springs[Math.floor(randomAt(97, boats, 1) * springs.length)], boats, 2), 'boat');boats++;nextBoat = clock + 2.6 + randomAt(97, boats, 5) * 1.8; }
      while (riders.length && clock - riders[0].born - riders[0].path.duration > 1.2) riders.shift();

      // Windows, then arrows: the field sweeps in left to right, holds, then gives way to the streaks.
      const sweep = smooth(.14, .36, u), gone = 1 - smooth(HANDOVER[0], HANDOVER[1], u), release = smooth(.42, .52, u) * gone, arrows = 1 - smooth(.42, .52, u);
      if (sweep > 0 && arrows > 0) {
        const side = grid.step * scale * .86;
        for (let pass = 0; pass < 2; pass++) {
          for (const k of moving) {
            const x = grid.x + (k % grid.cols) * grid.step, y = grid.y + Math.floor(k / grid.cols) * grid.step, local = clamp((sweep * 1.45 - x / field.width) / .45);
            if (local <= 0) continue;
            const [px, py] = onto(x, y), speed = Math.hypot(field.u[k], field.v[k]);
            if (pass === 0) { if (local < .62) { const size = Math.min(1, local / .25) * side;pen.strokeStyle = hsla(40, 40, 97, .7 * arrows);pen.lineWidth = 1;pen.strokeRect(px - size / 2, py - size / 2, size, size); }continue; }
            const grow = clamp((local - .3) / .7) * arrows;if (grow <= .02) continue;
            const part = Math.min(1, speed / field.speed.fast), reach2 = (.3 + .62 * part) * grid.step * scale * grow / speed, tx = px + field.u[k] * reach2, ty = py + field.v[k] * reach2, ux = field.u[k] / speed, uy = field.v[k] / speed, head = (2.2 + 2.6 * part) * thick * grow;
            pen.strokeStyle = pen.fillStyle = tone(speed);pen.lineWidth = 1.3 * thick;
            pen.beginPath();pen.moveTo(px, py);pen.lineTo(tx, ty);pen.stroke();
            pen.beginPath();pen.moveTo(tx + ux * head, ty + uy * head);pen.lineTo(tx - uy * head * .7, ty + ux * head * .7);pen.lineTo(tx + uy * head * .7, ty - ux * head * .7);pen.closePath();pen.fill();
          }
        }
      }
      // Streaks in six speeds: a dark line under a bright one, so they read on foam and on rock.
      if (release > 0) {
        const lines = streaks.sample(clock, release), n = lines.points;
        for (const [width, alpha, dark] of [[3.2, .3, true], [1.4, .95, false]]) {
          for (let bucket = 0; bucket < 6; bucket++) {
            pen.beginPath();
            for (let q = 0; q < lines.count; q++) {
              if (Math.min(5, Math.floor(lines.speed[q] / field.speed.fast * 6)) !== bucket) continue;
              const o = q * n * 2;pen.moveTo(fx + lines.positions[o] * scale, fy + lines.positions[o + 1] * scale);
              for (let k = 1; k < n; k++) pen.lineTo(fx + lines.positions[o + k * 2] * scale, fy + lines.positions[o + k * 2 + 1] * scale);
            }
            pen.strokeStyle = dark ? hsla(218, 70, 20, alpha) : tone(field.speed.fast * (bucket + .5) / 6, alpha);pen.lineWidth = width * thick;pen.stroke();
          }
        }
      }
      // Paper boats, the ones from the table: each turns to face the way it is carried and rocks as it rides.
      for (const rider of riders) {
        const age = clock - rider.born;if (age > rider.path.duration) continue;
        const now = rider.path.at(age), before = rider.path.at(Math.max(0, age - .18)), [x, y] = onto(now.x, now.y);
        const speed = Math.hypot(now.x - before.x, now.y - before.y) / .18, turn = (speed > 6 ? Math.atan2(now.y - before.y, now.x - before.x) : 0) + Math.sin(clock * 3.1 + rider.born * 7) * .14;
        paintBoat(x, y, 10 * thick * Math.min(1, .3 + age * 3), turn, rider.hue);
      }
      // Under the pointer: the measurement at that place, as an arrow and a number.
      const small = w < 520, size = small ? 11 : 12.5;
      pen.font = `500 ${size}px ui-sans-serif, -apple-system, "Segoe UI", sans-serif`;pen.textBaseline = 'middle';
      if (pointer && close === 0 && u > .2 && u < HANDOVER[0]) {
        const p = view.toField(pointer.x, pointer.y), m = sampleFlow(field, p.x, p.y), speed = Math.hypot(m.u, m.v);
        if (speed >= 10) {
          const reach2 = (16 + 40 * Math.min(1, speed / field.speed.fast)) * thick, ux = m.u / speed, uy = m.v / speed, tx = pointer.x + ux * reach2, ty = pointer.y + uy * reach2;
          for (const [colour, width] of [[hsla(220, 40, 10, .6), 5.5], [hsla(44, 96, 66), 2.6]]) { pen.strokeStyle = colour;pen.lineWidth = width;pen.beginPath();pen.moveTo(pointer.x, pointer.y);pen.lineTo(tx, ty);pen.stroke(); }
          pen.fillStyle = hsla(44, 96, 66);pen.beginPath();pen.moveTo(tx + ux * 7, ty + uy * 7);pen.lineTo(tx - uy * 5, ty + ux * 5);pen.lineTo(tx + uy * 5, ty - ux * 5);pen.closePath();pen.fill();
          const text = `${(speed / field.speed.median).toFixed(1)}× the median speed`, tw = pen.measureText(text).width + 18, lx = clamp(pointer.x + 14, 8, w - tw - 8), ly = clamp(pointer.y - 24, 20, h - 20);
          pen.fillStyle = hsla(220, 20, 10, .78);pen.beginPath();pen.roundRect(lx, ly - size * .95, tw, size * 1.9, size);pen.fill();pen.fillStyle = hsla(44, 80, 86);pen.fillText(text, lx + 9, ly + .5);
        }
      }
      // The key: what the colours mean and what the measurement rests on, above the code card.
      if (sweep > 0 && close === 0 && gone > 0) {
        const words = ['slow', 'fast', `${moving.length} moving windows`, `${field.pairs} frame pairs`], widths = words.map((word) => pen.measureText(word).width), ramp = small ? 36 : 52, gap = small ? 7 : 10, pad = small ? 10 : 13;
        const count = small ? 2 : 4, total = widths.slice(0, count).reduce((sum, value) => sum + value, 0) + ramp + gap * (count + 1) + pad * 2, height = size + pad * 1.4;
        const chip = document.querySelector('.chip')?.getBoundingClientRect(), left = small ? 12 : 34, y = (chip ? chip.top : h - 160) - 14 - height / 2 + (1 - Math.min(1, sweep * 4)) * 60;let x = left + pad;
        pen.globalAlpha = gone;pen.fillStyle = hsla(220, 20, 10, .74);pen.beginPath();pen.roundRect(left, y - height / 2, total, height, height / 2);pen.fill();
        pen.fillStyle = hsla(40, 20, 94);pen.fillText(words[0], x, y + .5);x += widths[0] + gap;
        for (let q = 0; q < 6; q++) { pen.fillStyle = tone(field.speed.fast * (q + .5) / 6);pen.fillRect(x + q * ramp / 6, y - 2.5, ramp / 6 + .5, 5); }
        x += ramp + gap;pen.fillStyle = hsla(40, 20, 94);pen.fillText(words[1], x, y + .5);x += widths[1] + gap * 2;
        pen.fillStyle = hsla(40, 20, 76);for (let q = 2; q < count; q++) { pen.fillText(words[q], x, y + .5);x += widths[q] + gap; }
      }
      pen.globalAlpha = 1;pen.restore();
      // The pillar the shot opens from, sliding off to the left with a soft shadowed edge.
      const slide = smooth(0, .13, u);
      if (slide < 1) {
        const edge = w * (1 - slide * 1.08);
        const shadow = pen.createLinearGradient(edge, 0, edge + 40, 0);shadow.addColorStop(0, 'rgba(10,20,24,.35)');shadow.addColorStop(1, 'rgba(10,20,24,0)');
        pen.fillStyle = shadow;pen.fillRect(edge, 0, 40, h);
        const face = pen.createLinearGradient(0, 0, 0, h);wipe.forEach((colour, i) => face.addColorStop(i / (wipe.length - 1), colour));
        pen.fillStyle = face;pen.fillRect(0, 0, Math.max(0, edge), h);
      }
      shade.style.opacity = String(smooth(.1, .2, u) * (1 - smooth(.8, .86, u)));
      return 1 - close;
    },
  };
}
