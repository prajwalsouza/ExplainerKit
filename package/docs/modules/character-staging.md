# Character staging: ground, size and crowds

Use `explainerkit/characters` to place characters on a floor or slope, change their size over time, and arrange rows of people. Ground position and scale are calculated from time so seeking backward reproduces the same result. A surface supplies ground height, while each character’s measured rest height connects its artwork to the size you request.

```js
import { scene } from 'explainerkit';
import { character, crowd, surface, starter } from 'explainerkit/characters';

const s = scene({ width: 1600, height: 900 });
const floor = surface({ y: 820 });                                   // or { points: [[x, y], …] }
s.path({ commands: floor.raise(330).commands({ x0: 0, x1: 1600, bottom: 900 }), fill: '#e8dcc6' });

const guests = crowd(s, 23, { ground: floor, seed: 4 });             // three rows, back row painted first
const bo = character(s, starter('bean-everyday'), { x: 200, standOn: floor, height: '1.7m', unit: 100 });
bo.walkTo(900, { at: 1 });                                           // feet follow the floor
bo.scaleTo(.05, { at: 6, duration: 2 });                             // shrink to mouse size about the feet
```

## Ground: `surface(spec)`

| Spec | Meaning |
| --- | --- |
| `{y}` | Place a flat floor at scene y. |
| `{points: [[x, y], …]}` | Connect 2–4096 points into slopes, hills or steps, with x strictly increasing. Beyond either endpoint the ground stays at that endpoint’s height. |

A surface stores its geometry immutably. Call `yAt(x)` for the ground height at a position, or `raise(dy)` to create an elevated copy for a stage or farther crowd row. `commands({x0,x1,bottom})` returns a closed path from the surface down to `bottom`, which you can draw as the floor and make visible to the audit.

## Standing on it

- `character(scene, def, {x, standOn: surface, …})` puts the root on `surface.yAt(x)` every frame, during `walk`, `run`, `walkTo` and hops (hops lift off the surface and land back on it). Leave `y` out; it comes from the surface.
- `standOn(actor, surface)` (or `actor.standOn(surface)`) moves an existing character onto a surface from then on. `actor.ground` is the current surface.
- **Feet stay planted.** Each foot meets the ground under its own world x, so a planted foot keeps one ground point on a slope too (the existing no-slide guarantee, tested on flat and sloped ground). The biped rigs then lower the hips just enough for the downhill leg to reach (compass-gait drop, the same rule walks already use).
- Fish and microbes have their root at the body centre, so for them the surface is the line the body centre follows.

```demo design-slope-stroll
Drag the trail marker to walk the hill. A dot marks a foot when its socket meets the ground below it. Watch a planted dot stay put while the walker’s body moves on. Ground rules apply.
```

## Size over time: `actor.scaleTo(k, {at, duration, ease, anchor})`

`actor.scaleTo(k,{at,duration,ease,anchor})` changes size to a multiplier of the authored size over `[at,at+duration]`. Defaults are `at:0`, `duration:1` and `ease:'easeInOut'`, and another named easing or progress function can be supplied. Successive calls start from the previous value. Thus `scaleTo(2).scaleTo(.5,{at:3})` follows 1 → 2 → 0.5. Scaling clips cannot overlap.

- `anchor` defaults to `feet` for bipeds and birds and `center` for fish and microbes. This keeps the rig’s root stationary while size changes. A biped off a surface can instead use `center`, and a fish or microbe can use `feet` for its lowest point. A character on a surface always scales about its feet.
- Walk speed in scene units is character units per second multiplied by current size. `walkTo(x)` arrives exactly at x when size stays constant. If walking overlaps `scaleTo`, travel integrates the changing size with a fixed 32-step calculation. The result still depends only on time, but feet are guaranteed not to slide only while size stays constant because stride and stance change with the body.
- `actor.sizeAt(t)` returns the drawn size multiplier at the requested time.

## Real-world size: `{height}`, `restHeight(def)`

Set `height` to request a drawn rest height in scene units. For example, `{height:170}` chooses a size multiplier of `170 / restHeight(def)`. For a physical length such as `'1.7m'`, `'170cm'` or `'1700mm'`, also supply `unit` as scene units per metre. Choose either `size` or `height`.

`restHeight(def)` measures rest-pose artwork without the ground shadow, sampling curves and including half-stroke widths. `restBounds(def)` returns `{x0,y0,x1,y1,width,height,head}` in character coordinates, where y points down and ground is zero. The `head` field bounds artwork attached to the head bone. Use `sceneLength(value,unit)` when only the unit conversion is needed.

| Starter | Rest height | Rest width |
| --- | --- | --- |
| bean-everyday | 198.0 | 80.8 |
| bean-scientist | 193.0 | 80.8 |
| bean-engineer | 195.0 | 92.8 |
| bean-student | 201.5 | 94.1 |
| bean-night | 193.0 | 80.8 |
| stick-classic | 176.0 | 42.3 |
| stick-xkcd | 174.3 | 40.9 |
| stick-bold | 174.0 | 49.5 |
| stick-pill | 174.0 | 54.1 |
| bird-robin, bird-canary, bird-bluebird | 97.2 | 100.8 |
| fish-clown, fish-teal | 83.2 | 117.0 |
| microbe-mint, microbe-violet | 97.2 | 131.9 |

Hair style and accessories change a bean's height, so measure the definition you use rather than this table. The height test draws every starter at `height: 170` and measures 170.00 in the rendered frame.

## Crowds: `crowd(scene, cast, spec)`

Pass `cast` as an array of definitions to use one character per definition, or as a count to create repeatable seeded bean characters. The result contains `{actors,spots,rows,surfaces,tag}`. `actors[i]` and `spots[i]` belong to the same cast member, with each spot recording `{x,y,size,row,facing,surface}`. `rows` lists member indices with the front row first, and `surfaces[r]` gives the ground for that row.

| Option | Default | Meaning |
| --- | --- | --- |
| `ground` | `surface({y: 0.8 × height})` | The front row's surface, or one surface per row, front first (bleachers, terraces). |
| `rows` | round(√(n / 2.5)) | Number of rows (3 for 23 people). Front rows fill first; the last row keeps the places nearest the centre. |
| `x0`, `x1` | 12% and 88% of the width | Outermost front-row places. |
| `stagger` | `'half'` | Each row sits half a place off the row in front, so heads fall in the gaps. Odd rows have one place fewer to stay inside `[x0, x1]`. `'none'` lines rows up. |
| `depthScale` | 0.85 | Size ratio from each row to the one behind it. |
| `rise` | 0.6 × the nearer row's body height | How much higher each farther row stands (scaled by `depthScale` per row when given). |
| `size` / `height` | largest size ≤ 1 that leaves a tenth of a place between front-row bodies | Front-row size multiplier, or front-row drawn height (with `unit` for metres). |
| `facing` | `'center'` | Members left of centre face right and vice versa; or `1` / `-1`. |
| `seed` | 1 | Varies looks (count form) and blink timing. |
| `tag` | `'crowd'` | Tag on every member, so the composition audit treats the crowd as one group; `null` for none. |
| `each` | `{}` | `idle`, `shade`, `secondaryMotion` for every member. |

On flat and sloped test floors, each member’s feet meet its row’s `surface.yAt(x)`. Farther rows are smaller and higher, and the back row is painted first. Adjacent-row heads do not overlap. When the chosen size or `rise` would cause overlap, the farther row is raised enough to leave 5% of the nearer row’s height as clearance. Members remain ordinary characters on their row surfaces and can walk or act afterward.

The defaults come from the layout tuned by eye for *23 Strangers* (rows 0.85 apart in size, half-place stagger, about 0.6 of a body height between rows) and rest on two standard pictorial depth cues, relative size and height in the visual field (Cutting & Vishton, “Perceiving layout and knowing distances”, 1995).

### Audit evidence

`tests/modules/character-ground-crowd.test.js` builds a 23-member crowd with `crowd()` + `surface()` on a floor drawn with `surface.commands()` and runs `auditFrame(frame, {tagsOf: id => scene.tagsOf(id)})`. The `floating` rule reports nothing on a flat and a sloped floor. Raising one back-row member 120 units with `standOn(actor, row.raise(120))` makes it fire exactly once (“… in “crowd” stands 14 px above the ground the rest of its group stands on (22 of 23 …)”).

## Limits

- A character can follow one surface at a time. Switching with `standOn` is immediate, so switch while the character is off its feet or outside the view.
- A surface supplies one height for each x coordinate and cannot contain an overhang. A stair riser is represented as a steep slope between treads, and feet do not choose discrete footholds.
- Characters do not lean into a slope. Very steep ground can lower the hips enough to look like crouching.
- `scaleTo` keeps its anchor on the vertical line through the root and does not provide an off-axis pivot.
- Every crowd member is a full character by default. A recorded Node measurement sampled 23 members on a slope in about 19 ms per frame. See [crowd level of detail](film-craft.md#crowds-and-speech) for a simpler representation chosen at construction.
- Draw a large filled shape beneath the feet when the `floating` audit must detect the crowd’s floor. The audit cannot inspect a floor that has not been drawn.