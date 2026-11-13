# Motion that can be sampled in either direction

Use a particle emitter when many small marks should follow repeatable trajectories, or a mechanism when connected parts should obey geometric ratios. Both compute from an explicit time or input rather than integrating from the last frame. They do not own clocks or depend on playback frame rate, so scrolling backward samples the same construction again.

The [physics module](stroke-springs-paths.md) provides springs and release motion separately. Particles add procedural births and noise, while mechanisms solve ideal geometric relationships. None of these APIs supplies a general rigid-body simulation.

## Emit particles without a hidden simulation

```js
import {emitter} from 'explainerkit/particles';

const sparks = emitter({
  seed: 734,
  rate: 40, life: 2,
  origin: {x: 200, y: 180, z: 0},
  velocity: {x: 0, y: -70, z: 0},
  spread: {x: 35, y: 15, z: 10},
  acceleration: {y: 60},
  drift: {amplitude: 5, frequency: .8},
});
const visible = sparks.sample(1.25);
const gpu = sparks.buffers(1.25); // {positions, ids, count}
```

Create an emitter with an origin, birth rate, lifetime and initial motion, then sample it at the desired time. Its controls determine particle identity and geometry without deciding how the scene should paint them.

| Option | Default / bound | Meaning |
| --- | --- | --- |
| `seed` | 0; integer 0–2³²−1 | It determines random values together with each particle ID. |
| `rate` | 30; 1e-6–10,000 | It sets particle births per second. |
| `life` | 2; 1e-6–3600 | It sets lifetime in seconds. |
| `start`, `end` | 0, 86,400 | They bound births to `[start,end)`. |
| `origin` | `{x:0,y:0,z:0}` | It sets birth position. |
| `velocity` | `{x:0,y:-30,z:0}` | It sets mean initial velocity in units per second. |
| `spread` | Zero vector | It adds independent uniform positive or negative velocity variation on each axis. |
| `acceleration` | Zero vector | It sets constant acceleration in units per second squared. |
| `drift` | `{amplitude:0,frequency:1}` | It adds smoothly varying displacement within a fixed bound. A number abbreviates amplitude. |
| `maxParticles` | 10,000; integer 1–100,000 | It limits the number alive in one sample. |

Omitted vector components default to zero. Construction captures inputs so later edits to those objects cannot change the emitter. Coordinate and velocity arithmetic must stay within ±10,000,000. Drift amplitude accepts 0–100,000 and frequency 1e-6–1000. Before preparation, the request must satisfy `ceil(min(life,end-start) × rate) ≤ maxParticles`. Sampling then visits only birth indices that could still be alive rather than traversing every particle ever born.

A particle's nonnegative birth index is its ID. Its birth time is `start + id/rate` and its age is `time − birth`, with a live interval of `[0,life)`. Birth and death share index arithmetic so an integer `life × rate` expires at the replacement birth. The earlier of that boundary and `birth + life` resolves floating-point rounding. Random channels depend only on seed and ID. Use `particle(id,time)` to request one particle or null, and `sample(time)` for the frozen records shown below.

```js
{id, birth, age, progress, life,
 position: {x,y,z}, initialVelocity: {x,y,z}}
```

Base position follows `origin + initialVelocity × age + acceleration × age²/2`. Drift adds the difference between noise at the particle's age and noise at birth, making its initial displacement zero. It does not model forces, fluids or a random walk. The recorded `initialVelocity` therefore describes the base trajectory rather than the derivative of its drifted path. Map progress to opacity, size or color in your application.

Use `buffers(time)` when a renderer needs typed arrays. It returns new Float32 xyz positions and Uint32 IDs owned by your application, and editing them does not affect another sample. Float32 conversion introduces the precision used for GPU transfer. Feed these arrays into a keyed scene collection or the WebGL points renderer as needed. Computing the emitter sample itself performs no draw or upload and does not require Three.js or another GPU backend.

## Give a displacement some coherent variation

```js
import {noise2, noise3, noiseField} from 'explainerkit/particles';
const value = noise2(.2, .5, {seed: 12});
const volumeValue = noise3(.2, .5, .8, {seed: 12});
const field = noiseField({seed: 12, frequency: .05, amplitude: 10, octaves: 3});
const displacement = field.sample({x: 100, y: 40, z: 0}, 2.5);
```

The scalar helpers provide value noise, which assigns seeded values to a lattice and interpolates smoothly between them. The implementation uses its own integer hash and a fifth-degree interpolation polynomial. Results lie in [-1,1] for coordinates within ±10,000,000. It does not import a Perlin package or reproduce Perlin's reference values. [Perlin's Improving Noise paper](https://www.cs.cmu.edu/~jkh/462_s07/paper445.pdf) discusses the continuity principle, while the hash, lattice values and field construction are this implementation's choices.

`noiseField({seed=0,frequency=1,amplitude=1,octaves=1,lacunarity=2,gain=.5,speed=1})` returns a vector through `.sample(point,time)`. It combines 1–8 successive noise layers called octaves. Lacunarity multiplies frequency between layers within 1–8, and gain multiplies amplitude within 0–1. Normalized weights keep each component within ±amplitude.

Time shifts the third lattice coordinate by `speed × time`, and three independent seeds produce x, y and z displacement. The result is smoothly varying displacement rather than divergence-free flow or four-dimensional noise. Coordinates exceeding supported scaled precision are rejected rather than wrapped into an unintended field.

## One input can run a machine

```js
import {mechanism} from 'explainerkit/mechanisms';

const engine = mechanism();
const driver = engine.gear({id: 'driver', teeth: 20, module: 2});
engine.gear({id: 'driven', x: 50, teeth: 30, module: 2})
  .meshWith(driver);
const crank = engine.crank({id: 'crank', radius: 30});
engine.linkage({id: 'rod', crank, length: 90});

const state = engine.sample(angle);
// state.driver.rotation === angle
// state.driven.rotation === -angle * 20 / 30
// state.rod.start/end close a connecting rod of length 90
```

The builder stores a limited number of parts and directed relationships with no dependency cycles. It does not run a physics simulation. `mechanism({maxNodes=128})` accepts at most 256 parts. Give a constructor a unique short `id` to name a part yourself. Otherwise, it assigns `part1`, `part2`, and so on. Sampling returns a frozen ID→state record. Each part also has `sample(input)` for its own state. Inputs and sampled positions/angles must remain within ±10,000,000.

Choose the common input's unit according to the construction. A root gear or crank normally reads radians, while a rolling wheel reads distance along a path. Each part's ratio converts that input to the quantity it needs. Convert measured units through the data module before sampling rather than treating angles and distances as interchangeable.

### Wheels and gears

`wheel({id,x=0,y=0,radius=50,phase=0,ratio=1})` is a fixed-center rotating wheel until a rolling or belt relation claims its motion. The default rotation is `phase + ratio × input`.

A gear uses pitch radius `teeth × module / 2`, where module relates tooth size to count. An explicit radius must agree with that value. Tooth count is an integer in 3–10,000, and radius lies in [1e-6,100,000]. The model solves pitch-circle relationships rather than generating an involute tooth outline. Use the separate drawing helper when the teeth themselves must be visible.

Call `driven.meshWith(driver,{internal=false,phase=drivenPhase,tolerance=1e-6})` to connect gears from the same mechanism. It checks equal module and the required distance between pitch centers. External gears rotate oppositely and internal gears rotate together through `phase ± driverRotation × driverTeeth/drivenTeeth`. Phase sets a visual offset rather than inferring tooth-to-gap assembly. Cycles, mismatched centers or modules, and a second motion owner are rejected before replacing a working relationship.

### No-slip rolling

```js
const wheel = engine.wheel({radius: 10})
  .roll({on: [['M',0,0], ['L',200,0]], side: -1});
const pose = wheel.sample(30);
// center (30,-10), rotation 3 radians, contact (30,0)
```

`roll({on,offset=0,ratio=1,side=1,outside,tolerance=.25})` prepares a single contour through the shared path measurer. Signed path distance is `offset + ratio × input`. `side` is +1 or −1 along the directed path's perpendicular normal. On a horizontal +x path, side −1 places the wheel above the line, rotating clockwise as it travels right on a y-down stage.

A rolling wheel's center lies at the path contact plus `side × radius × normal`. Rotation combines unwrapped tangent change with `−side × distance/radius` to preserve the sampled no-slip relation. Closed paths retain total traveled distance and tangent winding. Their outside policy defaults to wrap, while open paths default to error. Clamp is also available, but wrapping an open path is rejected. The wheel radius is not stretched to force a fit.

Path positions and normals follow the declared curve tolerance. At a sharp corner, the offset center and tangent can change abruptly because this is a geometric relation rather than a contact-dynamics solution. An offset path may intersect itself or become singular if the wheel is too large for its curvature. A returned path sample therefore does not certify mechanical feasibility.

### Cranks and connecting rods

`crank({id,x=0,y=0,radius=50,phase=0,ratio=1})` returns its pivot, radius, rotation and `tip`. `linkage({id,crank,length,slider:{x,y,angle},branch=1})` connects that tip to a slider line with an exact rigid rod. The default slider line is horizontal through the crank pivot. `branch` selects one of the two geometric line/circle intersections. The linkage reports `start`, `end`, `rotation`, `position` and numerical `residual`.

`sliderCrank({center,radius,angle,rod,slider,branch})` exposes the same calculation without a builder. If the rod cannot reach the slider line at that angle, it throws `MECHANISM_UNREACHABLE` rather than bending or extending the rod. A valid first pose does not prove that all angles are feasible. Choose a branch explicitly because dead points cannot be resolved from an assumed previous frame.

This is the slider-crank family, not an arbitrary closed-loop linkage solver. [CMU's mechanisms notes](https://www.cs.cmu.edu/~rapidproto/mechanisms/examples.html) describe this family and its relationship to gears/belts. The implementation derives the line/circle geometry directly and includes independent closure tests.

### Belts and pulleys

`engine.belt({id,a,b,crossed=false,phase=drivenPhase})` connects two fixed-center wheels or gears and makes b follow a. Its angular ratio is `a.radius/b.radius`, with reversed sign for a crossed belt. Part a may already have a fixed-center gear or belt driver, but b must not have another owner. Rolling pulleys, self-links, cycles and overlapping or degenerate pitch circles are rejected.

Belt state includes two tangent segments, wrap angles, total length and both rotations. Use `beltGeometry({a:{x,y,radius},b:{x,y,radius},crossed=false})` to obtain the same immutable geometry and ratio directly. The ideal belt does not stretch, and the model does not simulate tension, sag, slip, tooth engagement or thickness. Tangent data does not draw the wrap arcs automatically. Use the returned angles and pulley states to construct that artwork.

## Use the existing scene contracts

```js
const angle = drawing.parameter(0, {min: 0, max: Math.PI * 2});
angle.to(0, Math.PI * 2, {duration: 5, ease: 'linear'});
const solved = engine.derive(drawing, angle);
rodDrawing.bind(['x1','y1','x2','y2'], {
  inputs: [solved],
  map: state => ({
    x1: state.rod.start.x, y1: state.rod.start.y,
    x2: state.rod.end.x, y2: state.rod.end.y,
  }),
});
```

Drive the mechanism graph from one scene input through `derive`, then bind its solved values to drawables as in the example. The scene's player and scroll controls remain responsible for time. Inputs must belong to the same scene. An invalid relationship fails before graph mutation, and an impossible sampled configuration leaves mechanism state unchanged. Samples can be requested in any order.

## Tests and limits

Native tests verify exact birth/lifetime boundaries, ballistic equations, ID-addressed spread/drift, backward samples, 100,000 live particles, buffer independence, noise bounds/continuity, analytical gear ratios, no-slip sign/distance, closed-path winding, 202 slider-crank branch/angle closures, perpendicular belt tangents, equal-pulley belt length, impossible rods, graph cycles, foreign handles and scene-derived seeking. A generated fixture or numerical pass does not establish natural-looking particles, a feasible physical engine, universal GPU throughput or an error-free perceptual effect.

These modules do not implement particle collisions or neighbor interactions, fluid solving, rigid-body contact, material stress, arbitrary mechanism loops, pulley tension or manufacturing geometry for gear teeth. Choose them for repeatable geometric authoring rather than physical feasibility or material simulation.

## Draw gears and stream particles to the GPU

Use `gearPath` to draw involute teeth and `meshWith(other,{phase:'interlock'})` to set a meshing phase. Use `emitter.cloud(time,{radius,color})` to fill a scene cloud directly from typed arrays. The [film kit](film-kit.md#gears-that-mesh) shows these drawing operations alongside their models.