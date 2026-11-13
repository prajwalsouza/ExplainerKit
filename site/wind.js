// A small, stable 2D wind field (semi-Lagrangian "stable fluids" after Jos Stam, 1999) on a coarse
// grid over the stage. The pointer splats momentum into it; a library noise field supplies a gentle
// ambient breeze; advection carries the air along itself, a pressure projection keeps it
// incompressible, so a sweep of the pointer rolls up into eddies that drift and fade.
// Work is fixed per step: one grid of 80 × 45 cells and 14 pressure iterations.
import { noiseField } from 'explainerkit/particles';

export function createWind({ width = 1600, height = 900, cell = 20 } = {}) {
  const nx = Math.ceil(width / cell), ny = Math.ceil(height / cell), n = nx * ny;
  let u = new Float32Array(n), v = new Float32Array(n), u0 = new Float32Array(n), v0 = new Float32Array(n);
  const p = new Float32Array(n), div = new Float32Array(n);
  const breeze = noiseField({ seed: 31, frequency: .0016, amplitude: 1, octaves: 2, speed: .12 });
  const at = (i, j) => Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i));
  /** Bilinear sample of a grid field at stage point (x, y). */
  function sample(f, x, y) {
    const gx = Math.min(nx - 1.001, Math.max(0, x / cell - .5)), gy = Math.min(ny - 1.001, Math.max(0, y / cell - .5));
    const i = gx | 0, j = gy | 0, a = gx - i, b = gy - j;
    return (f[at(i, j)] * (1 - a) + f[at(i + 1, j)] * a) * (1 - b) + (f[at(i, j + 1)] * (1 - a) + f[at(i + 1, j + 1)] * a) * b;
  }
  const splats = [];
  return {
    /** Push air: a Gaussian blob of velocity (px/s) at a stage point, applied on the next step. */
    splat(x, y, vx, vy, radius = 95) { splats.push({ x, y, vx, vy, radius });if (splats.length > 8) splats.shift(); },
    /** Air velocity at a stage point, px/s: the solved field plus the ambient breeze. */
    velocity(x, y, t) {
      // The breeze is a vector noise field: a steady drift to the right, wandering in strength and direction.
      const b = breeze.sample({ x, y, z: 0 }, t);
      return { x: sample(u, x, y) + 14 + 12 * b.x, y: sample(v, x, y) + 8 * b.y };
    },
    /** Curl (spin) of the air at a point, 1/s: how strongly an eddy turns a seed caught in it. */
    curl(x, y) { const h = cell;return ((sample(v, x + h, y) - sample(v, x - h, y)) - (sample(u, x, y + h) - sample(u, x, y - h))) / (2 * h); },
    step(dt) {
      dt = Math.min(dt, 1 / 30);
      for (const s of splats) {
        const r2 = 2 * s.radius * s.radius, i0 = Math.floor((s.x - s.radius * 2) / cell), i1 = Math.ceil((s.x + s.radius * 2) / cell), j0 = Math.floor((s.y - s.radius * 2) / cell), j1 = Math.ceil((s.y + s.radius * 2) / cell);
        for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
          const dx = (i + .5) * cell - s.x, dy = (j + .5) * cell - s.y, f = Math.exp(-(dx * dx + dy * dy) / r2);
          u[j * nx + i] += s.vx * f * .5;v[j * nx + i] += s.vy * f * .5;
        }
      }
      splats.length = 0;
      // Advect: each cell takes the velocity found where its air came from.
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i, x = (i + .5) * cell - u[k] * dt, y = (j + .5) * cell - v[k] * dt;
        u0[k] = sample(u, x, y) * .985;v0[k] = sample(v, x, y) * .985;
      }
      [u, u0] = [u0, u];[v, v0] = [v0, v];
      // Project: remove divergence so the air swirls instead of piling up.
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { div[j * nx + i] = -.5 * (u[at(i + 1, j)] - u[at(i - 1, j)] + v[at(i, j + 1)] - v[at(i, j - 1)]);p[j * nx + i] = 0; }
      for (let it = 0; it < 14; it++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) p[j * nx + i] = (div[j * nx + i] + p[at(i - 1, j)] + p[at(i + 1, j)] + p[at(i, j - 1)] + p[at(i, j + 1)]) / 4;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i;u[k] -= .5 * (p[at(i + 1, j)] - p[at(i - 1, j)]);v[k] -= .5 * (p[at(i, j + 1)] - p[at(i, j - 1)]); }
    },
  };
}
