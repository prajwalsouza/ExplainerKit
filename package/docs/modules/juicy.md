# Juicy motion

Interactive pages feel alive when things respond physically. A stem bends in the wind the pointer stirs and springs back. A button overshoots and settles, and a seed lets go only after a visible tug. `explainerkit/juicy` provides those responses as small simulations you step yourself. The page supplies the time step and the inputs, so nothing here starts a clock or touches the page.

These simulations are live, unlike the analytic models in `explainerkit/physics`, which you can sample at any time. A live simulation's state depends on every earlier step. Each one therefore offers `snapshot()` and `restore()`, so a recorded run of inputs can be replayed exactly. Every step is capped at 1/20 of a second, so a slow frame cannot make a simulation explode.

## Bend a stem in the wind

This example builds a stem of eight points pinned at the ground, stirs the air where the pointer moves and steps both each frame. It assumes a `canvas` element and a `requestAnimationFrame` loop that passes the frame time.

```js
import {softChain, windField} from 'explainerkit/juicy';

const stem = softChain({points: Array.from({length: 8}, (_, i) => ({x: 400, y: 600 - i * 30})), stiffness: 20, bend: 0.4});
const air = windField({width: 1600, height: 900, cell: 20, breeze: {x: 14, gust: 12}});

canvas.addEventListener('pointermove', (e) => air.splat(e.offsetX, e.offsetY, e.movementX * 60, e.movementY * 60));

let last = 0;
function frame(now) {
  const dt = (now - last) / 1000, t = now / 1000;
  last = now;
  air.step(dt);
  stem.step(dt, {wind: (x, y) => air.velocity(x, y, t)});
  draw(stem.points());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

The stem is a Verlet chain. Each point remembers its previous position, and its velocity is the difference between the two. After moving the points, the chain pulls them back to their link lengths several times per step. `stiffness` is a spring toward the rest shape, given as acceleration per unit of offset, so 0 is a loose rope and larger values make a springier rod. `bend` resists folding, and `drag` sets how strongly the wind carries each point. Pinned points stay where they are unless you move them with `pin(i, {x, y})`. After each step, `tension` reports the largest relative stretch of any link.

The wind is a small stable-fluids grid after Jos Stam's 1999 method. Each step carries the air along its own motion and then removes any build-up or drain, which makes a sweep of the pointer roll into eddies instead of piling up. `velocity(x, y, t)` reads the air, including the breeze, and `curl(x, y)` gives how fast it spins at a point. The grid is limited to 40,000 cells and 60 pressure iterations, so the cost of a step is fixed.

## Follow a target with a spring

A chaser follows a target with a spring, overshooting and settling. Use it for hover lifts, gaze and anything that should ease toward where the reader points.

```js
import {chaser} from 'explainerkit/juicy';
const lift = chaser({value: 0, stiffness: 170, damping: 14});
card.addEventListener('pointerenter', () => (lift.target = 12));
card.addEventListener('pointerleave', () => (lift.target = 0));
// each frame:
lift.step(dt);
card.style.transform = `translateY(${-lift.value}px)`;
```

A chaser follows one number or a list of up to 16 numbers. `snap(value)` jumps with no motion, `kick(velocity)` pushes it as if struck, and `settled` is true once it has come to rest. Long steps are split into substeps of 1/240 s, so a stiff spring stays stable at a low frame rate.

## Shape impacts and idle motion

These helpers are pure functions, so you can call them with any time or velocity.

| Helper | Result |
| --- | --- |
| `squash(vx, vy, {amount, max, speed})` | Stretch along the motion and squash across it. The two scales multiply to 1, so the area stays the same. `angle` gives the direction to rotate by. |
| `pop(age, {frequency, decay})` | 0 before an arrival, then a value that springs past 1 and settles on it. Multiply a scale by it when something appears or is tapped. |
| `sway(t, {seed, index, amount, rate})` | A slow wander for idle grass, flowers and hanging things. Each index moves differently, so a field of plants never moves in step. |
| `hitstop(time, hits)` | Action time that freezes briefly at each `{at, hold}` hit. Feed it to the rest of the scene so an impact lands with a short pause. |

```demo design-double-crunch
An apple a day keeps the clock away. Scrub through the two landings. The second apple holds its contact pose while the outer clock continues to advance.
```

## Let go after a visible pull

`tug` releases only after a pull has lasted long enough, so a seed or a peg is seen to strain before it lets go.

```js
import {tug} from 'explainerkit/juicy';
const hold = tug({threshold: 1, hold: 0.25});
// each frame, with pull measured from your own simulation:
if (hold.step(dt, pull)) releaseSeed();
```

Strain builds while the pull exceeds `threshold` and drains `recover` times faster when it does not. The step that reaches `hold` seconds returns `true` once. After that, `released` stays true until `reset()`.

## Shake the screen

`trauma` is a screen shake. Each `kick` adds trauma, which decays every step, and the offset grows with trauma squared, so small hits stay subtle and large ones rattle. The motion uses smooth noise rather than random jumps.

```js
import {trauma} from 'explainerkit/juicy';
const shake = trauma({distance: 12, angle: 0.05});
shake.kick(0.4);
// each frame:
const {x, y, rotation} = shake.step(dt).offset();
```

## Limits

A chain has 2 to 512 points and up to 40 constraint iterations per step. Wind splats wait in a queue of at most 16 and are applied on the next step. Every input number is checked, and a wind function that returns a non-finite value is rejected rather than allowed to corrupt the chain. These simulations are for interactive feel. Reproducing them in a film means recording the inputs and replaying them from a snapshot.
