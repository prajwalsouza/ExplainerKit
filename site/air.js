// Seeing the wind: motes of pollen and fluff carried by the wind field. In still air they hang and
// drift; where the pointer stirs the air they streak along its flow and curl into its eddies, so
// the field itself becomes visible. Each mote differs in size, weight and brightness.
import { hsla } from 'explainerkit/color';
import { randomAt } from 'explainerkit/noise';

const COUNT = 220;

export function createMotes({ width = 1600, height = 900 } = {}) {
  const r = (i, c) => randomAt(71, i, c);
  const motes = Array.from({ length: COUNT }, (_, i) => ({ x: r(i, 0) * width, y: r(i, 1) * height, vx: 0, vy: 0, size: .6 + r(i, 2) ** 2 * 2.2, weight: .4 + r(i, 3) * .8, glow: .4 + r(i, 4) * .5, warm: r(i, 5), wisp: r(i, 6) < .25 }));
  return {
    motes,
    /** Carry every mote with the air; light ones follow it closely, heavier ones lag and settle. */
    step(dt, t, air) {
      dt = Math.min(Math.max(dt, 0), 1 / 30);
      for (const m of motes) {
        const w = air.velocity(m.x, m.y, t), k = 3.2 / m.weight;
        m.vx += (w.x - m.vx) * Math.min(1, k * dt);m.vy += (w.y - m.vy) * Math.min(1, k * dt) + 6 * m.weight * dt;
        m.x += m.vx * dt;m.y += m.vy * dt;
        // Motes that leave the stage re-enter upwind, so the air never empties.
        if (m.x > width + 40) { m.x = -30;m.y = randomAt(72, Math.floor(t * 10), m.size * 100) * height; }
        if (m.x < -60) m.x = width + 30;
        if (m.y > height + 40) m.y = -30;
        if (m.y < -60) m.y = height + 30;
      }
    },
  };
}

/** Paint the motes: a soft dot when still, a streak along the flow when the air is moving. */
export function paintMotes(ctx, field, { alpha = 1 } = {}) {
  if (alpha <= 0) return;
  ctx.save();ctx.lineCap = 'round';
  for (const m of field.motes) {
    const speed = Math.hypot(m.vx, m.vy), streak = Math.min(1, speed / 500), a = alpha * m.glow * (.35 + .65 * Math.min(1, speed / 160));
    ctx.strokeStyle = m.warm < .5 ? hsla(36, 24, 58, a) : hsla(28, 12, 48, a * .8);
    ctx.lineWidth = m.size * (m.wisp ? .7 : 1);
    const len = (m.wisp ? 40 : 10) * streak + .1, ux = speed ? m.vx / speed : 0, uy = speed ? m.vy / speed : 0;
    ctx.beginPath();ctx.moveTo(m.x - ux * len, m.y - uy * len);ctx.lineTo(m.x, m.y);ctx.stroke();
  }
  ctx.restore();
}
