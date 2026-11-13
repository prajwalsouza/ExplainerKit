# Runtime API

A scene keeps the shapes in an explanation together with the values and motion that determine their appearance. When you sample it at a chosen time, it calculates a frame without needing to play the earlier frames. A renderer draws that frame, while a player supplies the browser controls and clock needed to move between moments. This separation lets an animation and a reader interaction work on the same construction.

Use [Getting started](getting-started.md) when you need the npm or plain HTML setup that displays a first frame. This page then follows the same objects through values, repeated components, interaction and playback, with lookup tables for their methods. Follow the linked module guides when a specialized calculation or renderer combination needs a more detailed explanation. The library is an alpha release, so its APIs may still change.

## A first scene

The first example assumes an npm project that resolves ES module imports and an HTML element with ID `stage`. It creates one parameter named `position`, binds that value to a circle's x coordinate and gives the player a slider for changing it. For file loading without a build tool, use the corresponding setup in [Getting started](getting-started.md#use-plain-html-without-npm) before trying the scene operations below.

```js
import { scene } from 'explainerkit/core';

const drawing = scene({ width: 640, height: 300 });
const position = drawing.parameter(60, { min: 20, max: 600 });
position.animate({ from: 60, to: 540, duration: 3, ease: 'smooth' });

drawing.circle({ y: 150, r: 24, fill: '#278b8c' })
  .bind('x', { inputs: [position], map: x => x });
drawing.control(position, { label: 'Position', step: 1 });

const player = await drawing.mount(document.querySelector('#stage'));
player.play();
```

The animation and slider both refer to `position`, which is why moving the slider changes the same circle that the animation moves. A slider edit pauses playback and temporarily overrides that parameter rather than rewriting the authored animation. Seeking restores values from the animation unless `reset:false` is supplied, allowing the reader to return to a reproducible moment. A reduced-motion preference blocks autoplay while leaving manual seeking available.

## Working objects

Creating a shape returns a handle, which is the JavaScript object used to edit or animate that particular shape. Values set in the construction code are its authored values. A binding or animation can take control of a property, in which case the reference calls that controller its driver. Release the existing driver before assigning another one so two systems do not attempt to write the same property.

The methods below distinguish creating an object from changing an object that already exists. Use the constructor table to choose the shape, then the shared properties and handle methods to describe its appearance and behavior. Module guides explain the combinations supported by each renderer.

### Scene constructors

Creating a shape inside a group gives it coordinates relative to that group. Moving or rotating the group therefore moves its children without changing the child coordinates themselves, while all of the shapes continue to belong to the same scene. The group exposes the same creation methods as the scene, so the relationship is useful for a small drawing as well as a reusable construction.

| Constructor | Geometry / behavior | Details |
| --- | --- | --- |
| `scene(options)` | `width=960`, `height=540`, `renderer='svg'`, accessible label/description, `maxNodes=10000`, explicit `duration` seconds | [Rendering boundary](modules/renderer-contracts.md) |
| `scene.shape(type, props)` | Create a group, circle, rectangle, line, path, text or cloud by type name | Properties are listed below |
| `scene.group(props, children)` | Create a group and optionally move existing top-level objects into it in the supplied order. | [Ownership and live clips](modules/dynamic-clips-callouts.md) |
| `scene.circle(props)` | Circle with `r` | [Graphics](modules/graphics.md) |
| `scene.rect(props)` | Rectangle with `width`, `height`, rounded-corner `rx` | [Graphics](modules/graphics.md) |
| `scene.line(props)` | Endpoints `x1,y1,x2,y2` | [Stroke tools](modules/label-callouts-strokes.md) |
| `scene.path(props)` | Use absolute move (M), line (L), cubic curve (C), quadratic curve (Q) and close (Z) commands. `trimStart`, `trimEnd` and `trimOffset` control the visible stroke. | [Paths and trim](modules/stroke-springs-paths.md) |
| `scene.ellipse(props)` | Create a path-backed ellipse or arc using `rx`, `ry`, `startAngle`, `endAngle` and `closed`. Angles use radians. | [Ellipse/arc contract](modules/label-callouts-strokes.md) |
| `scene.text(props)` | Draw text with the browser font system or registered font outlines, with optional measured wrapping and minimum screen size. | [Text controls](modules/production-scene-controls.md), [font loading](modules/font-outlines.md) |
| `scene.cloud(props)` | Draw x/y point pairs with optional radii and red/green/blue/alpha (RGBA) colors. Configure their appearance through `pointSize`, `pointShape` and `pointBlend`. | [Point rendering](modules/procedural.md) |
| `scene.component(definition)` / `scene.instance(component)` | Copy a reusable definition with named parts, then create an instance in this scene | [Components](#compute-once-draw-many) |

Groups provide `group.group(props)`, `group.circle(props)`, `group.rect(props)`, `group.line(props)`, `group.path(props)`, `group.ellipse(props)`, `group.text(props)`, `group.cloud(props)` and `group.instance(component)`. `group.add(handle)` can also move an existing top-level object into a group. Its numeric coordinates stay unchanged but acquire the group as their reference, so adoption does not preserve the previous world position automatically.

### Shared drawable properties

A property describes one aspect of an object, such as its position, paint or text. The coordinate system matters when assigning it because a child's position is relative to its parent, whereas the camera later maps the complete construction into the displayed view. The table keeps the property names exact and links effects or shape-specific behavior to the guide that explains their limits.

| Properties | Behavior / guide |
| --- | --- |
| `x`, `y`, `rotation`, `scaleX`, `scaleY` | Translation, radians and scale in parent-local coordinates |
| `pivot` | Choose the transform pivot with null/origin, a coordinate pair or a supported bounds keyword such as `center`. The pivot can be assigned or animated. [Pivot/skew](modules/renderer-foundations.md) |
| `skewX`, `skewY` | Slant angles in radians, limited to ±1.4. Combined translation, rotation, scale and skew apply to both geometry and live clips. Same guide |
| `opacity`, `fillOpacity`, `strokeOpacity` | Use values in [0,1]. Group opacity affects all children together, while fill/stroke opacity affects the individual shape’s paint. [Paint alpha](modules/production-scene-controls.md) |
| `fill`, `stroke`, `strokeWidth`, `fillRule` | Select supported colors, gradients or patterns, and choose `nonzero` or `evenodd` for the fill rule. See [graphics](modules/graphics.md), [painterly materials](modules/painterly-spatial-instances.md) |
| `strokeDasharray`, `strokeDashoffset` | Dash lengths are copied nonnegative values, and the pattern shift can be animated. Animated arrays must keep the same length. Using trim and dashes on one stroke is rejected. [Dashes](modules/label-callouts-strokes.md) |
| `strokeLinecap`, `strokeLinejoin`, `strokeMiterlimit` | Choose `butt`, `round` or `square` caps and `miter`, `round` or `bevel` joins with a bounded miter limit. Shorthand names receive error hints in the same guide. |
| `clip` | Null, an authored rect/circle/path descriptor **or an attached handle from this scene**. Live handle clips sample target geometry and ancestor transforms. [Live clips and ownership](modules/dynamic-clips-callouts.md) |
| `blur`, `glow`, `mask`, `blend`, `shade`, `texture` | Choose visual effects within the selected renderer’s resource limits. Unsupported combinations report an error. [Look](modules/look.md), [renderer contracts](modules/renderer-contracts.md) |
| `z`, `rotationX`, `rotationY`, `scaleZ`, `depth` | Position, rotation, scale and thickness for supported 3D tools. Setting these properties does not make SVG or Canvas render solid 3D objects. [Spatial/Three](modules/spatial-three.md) |
| Text content through `text`, `fontSize`, `fontFamily`, `fontWeight`, `letterSpacing`, `align`, `baseline` | Configure text content and layout with validated CSS font-family names/fallback lists or registered font outlines. [Fonts](modules/font-outlines.md) |
| Text layout through `textOutline`, `textAdvance`, `wrap`, `lineHeight`, `minScreenSize`, `halo` | Glyph paths and measured text width, wrapping with a registered font, line spacing, minimum screen size, and a background-colored stroke behind words. [Text controls](modules/production-scene-controls.md) |

Only properties supported by the selected shape can be changed. Geometry uses scene units that the chosen view maps to display pixels, angles use radians and time uses seconds, so those quantities should not be mixed with one another. Color strings accept hexadecimal colors, the supported names and numeric HSL/HSLA values from the [color module](modules/color.md), while arbitrary CSS paint expressions and resource URLs remain unsupported. Paths do not accept SVG arc commands (`A`), so use `scene.ellipse` or the geometry ellipse/arc helpers when an arc is needed.

### Handle methods

A handle keeps an object's identity while its properties change. Use `set()` for a direct authored edit, a binding when a property should follow scene inputs, or an animation when it should follow authored time. These choices determine which system owns the property and which operation must release it before another controller can take over.

| Method | Inputs and ownership |
| --- | --- |
| `handle.set(properties)` | Check all supplied properties before applying them. A property controlled by a binding or animation is rejected. |
| `handle.reset(property)` | Restore the authored value after releasing its driver, retaining any initially authored live clip. |
| `handle.bind(property, {inputs,map,active,lazy})` | Connect this scene’s parameters, derived values, data or ambient time to a property. The trusted callback receives their values and a read-only sample context and must have no side effects. |
| `handle.bind([p1,p2,…], {inputs,map})` | Evaluate one callback per sample to return the requested properties, with every output validated. |
| `handle.unbind(property)` | Explicitly release a binding |
| `handle.animate(property, options)` | Animate a number, coordinate pivot or supported dash array using `from/to`, `at=0` and `duration=1`, with named easing or a trusted easing function. Overlapping animations on the same property are rejected |
| `handle.keys(property, keys)` / `handle.replaceKeys(property, keys)` | Add chronological keyframes or replace that property's tracks. See [key editor](modules/film-kit.md) |
| `handle.clearAnimation(property)` | Remove the property’s authored animation tracks so another driver can control it |
| `handle.to(at, patch, options)` | Continue properties from the prior animation to new targets, with `duration=1.1` and `ease='easeInOut'` by default. |
| `handle.enter(at, options)` / `handle.exit(at, options)` | Show or hide an object through fade/rise/pop/cut/reveal effects at chosen times while retaining its animation and bindings. See [scene controls](modules/scene-controls.md) |
| `handle.dim(keys)` | Dim the object at chosen times and levels alongside entrances/exits without replacing its authored opacity. |
| `handle.part(name)` | Select a named component descendant (dot paths supported) |
| `handle.add(root)` / `handle.group(props)` | Adopt a root or create a child group. Group drawable constructors are listed above |
| `handle.instance(component)` | Add an instance below this group |
| `handle.tag(...names)` | Name groups of related objects for organization, layout and audits |
| `handle.explain(title, body)` | Attach explanation metadata consumed by supporting players |
| `handle.onTap(callback)` / `handle.onDrag(callback)` | Register trusted interaction callbacks for supporting players without adding browser listeners at registration time. |

A binding normally calculates its property whenever the scene is sampled, but `active:[from,until]` can limit it to a time interval and `lazy:true` can make evaluation depend on presence. Outside the relevant window, sampling uses the authored property rather than retaining a value from an earlier frame. The callback receives a sample context containing `time`, `width` and `height`, together with ambient/display information when relevant. The [production scene controls guide](modules/production-scene-controls.md) explains the interval and presence rules in detail.

### Scene inputs and sampled queries

Parameters store values that the scene can track, and derived inputs calculate results that several shapes can share. Sampling then evaluates those relationships for a specified time and view size without moving a separate playhead. The queries below let you inspect the resulting geometry or choose when the player should display it.

| API | Behavior |
| --- | --- |
| `scene.parameter(value,{min,max})` | Store a number within minimum/maximum limits and use its set/reset/animate/keys/override/release methods. Sample the parameter at a chosen time. |
| `scene.derive(inputs,map)` | Calculate a value once per scene sample and share the result between bindings |
| `scene.control(parameter,{label,step})` | Create a native range control with a required accessible label. |
| `scene.ambient(options)` | A time input supplied by the mounted player. Supply the same ambient time when sampling offline to reproduce a frame |
| `scene.registerFont(name,font)` | Register a parsed font’s letter outlines and spacing measurements for text. See [loading example](modules/font-outlines.md) |
| `scene.sample({time,width,height,ambient,displayWidth,effects})` | Final camera-projected frame, without mutating a playhead |
| `scene.sampleWorld(options)` / `scene.sampleView(options)` | Get geometry before the camera, or a camera-projected `{frame,view}`. The same time and inputs reproduce the same result |
| `scene.locate(handle,options)` | Find a scene object’s position, bounds and transform in world coordinates. Pass a binding’s sample context to reuse measurements from that sample |
| `scene.profile(options)` | Measure time spent evaluating scene objects without including browser/GPU drawing completion. See [profiling](modules/production-scene-controls.md) |
| `scene.mount(container,options)` | Create a renderer and player inside a page element, then use `play()` to start playback and `dispose()` to remove the view. |

The handle methods describe ordinary scene objects, while specialized tools may return objects with their own methods. For example, editing a line of glyphs belongs to [typography](modules/glyph-objects.md), and character actions or held props belong to [characters](modules/characters.md). Use those guides for their additional interfaces rather than assuming every shape supports the same domain operation.

Text properties retain their authored numerical values even when a browser displays them with less precision. `fontWeight` accepts finite values from 100 through 900, including fractional values during animation, while the available font faces and native renderer may round the visible weight. The sampled model retains the original value, so the rendered result depends on the environment as well as the numeric request.

`letterSpacing` uses pixels from −100 through 100. If a Canvas context lacks native letter-spacing support, visible nonzero spacing is refused with `RENDER_UNSUPPORTED` and `capability: 'text.letterSpacing'` before changing the displayed frame. Choose SVG or zero spacing for that environment rather than treating the requested spacing as successfully rendered.

## Compute once, draw many

Several properties may depend on the same calculation, such as the joint positions in a solved arm. A derived value gives that calculation a scene input of its own, allowing each binding to reuse its result during one sample. The example assumes `drawing` is the existing scene, `targetX` and `targetY` are its parameters, `solveTwoBone` has been imported from `explainerkit/rigs`, and `records` contains the data rows to count.

```js
const pose = drawing.derive([targetX, targetY], (x, y) =>
  solveTwoBone({ root: { x: 0, y: 0 }, lengths: [120, 80], target: { x, y }, unreachable: 'clamp' }));
drawing.line({ stroke: '#17181c', strokeWidth: 10 })
  .bind(['x1', 'y1', 'x2', 'y2'], { inputs: [pose], map: p => ({ x1: p.root.x, y1: p.root.y, x2: p.elbow.x, y2: p.elbow.y }) });
const rows = drawing.data(records, { key: 'id' });
const count = drawing.derive([rows], r => r.length);
drawing.text({ x: 20, y: 30 }).bind('text', { inputs: [count], map: n => `${n} people` });
```

A derived value runs at most once for each `sample()` call, so ten bindings using the same solved pose do not solve it ten times. Derived values can depend on other derived inputs, and a declared data-source input supplies its copied, frozen rows to the callback. Replacing that source can therefore update its readers. Reading `source.rows` only through a closure hides the dependency from the scene, which is why the input must be declared in the dependency array.

The input arrays passed to `derive` and `bind` must belong to this scene, contain no empty slots and have at most 10,000 entries. Entries implemented as getters or setters are rejected before the callback runs. If the callback itself throws, the library reports `BINDING_FAILED` and retains the original thrown value as `cause`, including null or undefined. An existing `KitError` retains its code and object identity so callers can still inspect the original failure.

## Choreograph a narrated scene

A narrated explanation can schedule changes around caption lines rather than scatter unrelated timestamps through the drawing code. `beats()` gives each line a reading interval and returns positions within that sequence, while entrances and moves use those positions as ordinary scene times. In this example, the number appears and shifts during the second caption line, with the fractional index placing the move part-way through that line.

```js
import { scene, beats } from 'explainerkit/core';

const b = beats([
  'Four buses run this morning.',
  'Twelve riders, four buses. Three per bus.',
]);
const s = scene({ width: 1600, height: 900 });
s.text({ text: '3', x: 800, y: 260, fontSize: 150 })
  .enter(b.at(1), { style: 'pop' })
  .to(b.at(1.5), { x: 600 })
  .dim([[b.at(2), .3]])
  .explain('Counting buses', 'Each bus is one vote: 12 ÷ 4 = 3.');
```

| API | Behavior |
| --- | --- |
| `beats(lines,{lead,pace,tail})` | Allocate one beat per caption line using reading pace (`max(4 s, chars/15 + 1.3 s)`). `at(i)` returns seconds and fractional indices move through a beat. Inspect the sequence through `starts`, `lengths`, `duration`, `index(time)`, `line(time)` and `progress(time, beat)`. |
| `handle.enter(at,{style,duration,delay,lift})` | `rise` (default), `fade`, `pop` or `cut`. Invisible before `at`. |
| `handle.exit(at,{style,duration,delay})` | Leaves the stage. |
| `handle.dim([[at, level], …])` | Steps back from focus without leaving. |
| `handle.to(at, patch, {duration, ease})` | Moves numeric properties, each move starting where the previous one ended. Implemented as ordinary animation tracks, so it owns those properties. |
| `parameter.to(at, value, opts)` | The same for a numeric parameter. A viewer's `set` still overrides it until `reset`. |
| `handle.explain(title, body)`, `onTap(fn)`, `onDrag(fn)` | Interaction records stored on the scene and read with `scene.interaction(id)`. Players identify the picked object, while the scene owns no DOM. `onDrag` receives `null` on release. |
| `scene.onReset(fn)` | Runs after `reset()`, for data sources or other scene-owned state that a seek should restore. |
| `clamp`, `lerp`, `ease.*`, `seeded(seed)` | Use numeric helpers with `ease` supplying `linear`, `smooth`, `easeOut` and `easeInOut`. `seeded` is a deterministic random stream, so a seek replays the same draws. |

Entrances, exits and dimming add presence effects after the shape's ordinary bindings and animation tracks have been evaluated. They multiply the resulting opacity and add the relevant y or scale offset, so a data-bound object can still enter on its caption beat. By contrast, `to()` and `animate()` control the properties they move, and those same properties cannot simultaneously be bound to another driver.

## Make it a film

A film presents several scenes through a shared playback interface. Its definition groups scene descriptions into chapters and supplies a `build` function for each scene, so the construction code can remain separate from captions, navigation and viewer controls. The following structure shows where those elements belong without requiring another scene model.

```js
import { film, palette } from 'explainerkit/film';

film({
  notes: 'Illustrative numbers…',
  terms: [[/riders?/, palette.green]],          // caption words take their stage colour
  store: {},                                     // viewer state that survives between scenes
  chapters: [{ name: 'Two ways to count', scenes: [{
    title: 'Count | the buses.',                 // the part after | takes the accent
    beats: ['Four buses run this morning.', '…'],
    build(s, b, film) { /* an ordinary ExplainerKit scene on a 1600 × 900 stage */ },
  }] }],
});
```

The `explainerkit/film` player uses ExplainerKit scenes and the SVG renderer, with control styles supplied by `explainerkit/film.css`. It presents a title card for each scene, a caption line, a segmented seek bar, playback speed, chapters and script sheets. Read-aloud playback can make the picture wait for speech, while deep links such as `#3` select scenes. Keyboard controls include Space, ←/→, Shift+←/→, F, C and N, alongside hover tips, pinned explanations, taps and drags.

A seek inside a scene calls `scene.reset()`, so an interaction's temporary choices last until the viewer seeks. While paused, `film.tween(parameter, value)` can animate the consequence of a tap using elapsed wall-clock time. `film.now()` reports the scene's local time and `film.onStageTap(fn)` handles taps on empty stage. Automated checks can use `window.explainerkitFilm.seek(seconds)` to inspect specified moments without playing the intervening frames.

Film scenes are authored on a fixed 1600 × 900 stage, which gives construction code one coordinate system to work in. The film then uses adaptive layout to fit supported content into the viewer's available space. Understanding that second step matters when objects must stay together or a camera shot must preserve its spatial relationships.

## Adapt to any screen

The adaptive planner decides whether to keep the authored arrangement or rearrange related objects for a smaller container. Tags describe those relationships, and a `together` group tells the planner that its members must remain one unit. The example assumes `s` is the scene and that `buses` and `numbers` contain its handles.

```js
s.defineTag('fleet').defineTag('bus', { parent: 'fleet' });   // a tag tree, as in Rhypple
buses.forEach(bus => bus.tag('bus'));
numbers.forEach(n => n.tag('averages'));
s.adaptive({ together: ['averages'], minText: 12, targetText: 16 });
```

The `analyse`, `planLayout`, `applyLayout` and `toAuthored` exports from `explainerkit/layout` inspect and rearrange sampled frames for a container. The film requests a plan for each scene and size using frames across its caption beats, then replans after a viewer edit. This makes motion bounds part of the arrangement rather than considering only the frame visible when layout began.

| Rule | What it does |
| --- | --- |
| Prefer the author | Keep the authored composition unchanged when it is readable at the fitted size. |
| Common region | Members of a `together` tag form one unit that is never split, wrapped or rearranged. |
| Common fate | Measure the space objects use over the whole scene, so a moving object keeps its route in one block. |
| Connectedness | A line or path spanning two regions joins them. |
| Proximity | Compare relative gaps so a label close below its drawing stays with it. When restacked, rows in one band remain closer than separate bands. |
| Similarity | Blocks that share a tag share a scale. |
| Hierarchy | Block scales differ by at most 2×. |
| Readable before fit | Each authored, stacked, same-scale stacked or wrapped candidate must fit. Choose readability first, then space use, then closeness to the authored arrangement. Remaining small text is lifted to `minText`. Scaling is always uniform. |

A plan includes a `report` showing the candidates' smallest text, coverage, fit and reason for selection. Films expose it as `window.explainerkitFilm.plan` so the application can inspect the choice rather than assume a small-screen arrangement is readable. Tags themselves organize objects without altering their geometry, and tag queries include the declared hierarchy through `tagsOf(id)` for ancestors and `tagged(name)` for descendants.

## One definition, several instances

A component stores a reusable tree of named parts, and an instance places that definition into a scene. Editing the definition can update the instances together, while a property override changes only the selected instance. The example continues with the existing `drawing` scene and creates a tile whose dot and label can be addressed independently.

```js
const tile = drawing.component({
  type: 'group',
  children: {
    dot: { type: 'circle', props: { r: 8, fill: '#278b8c' } },
    label: { type: 'text', props: { y: 28, fontSize: 14 } },
  },
});
const first = drawing.instance(tile);
first.set({ x: 40, y: 50 });
first.part('label').set({ text: 'One' });
tile.set('dot', { fill: '#da6746' }); // Shared edit.
first.part('dot').set({ fill: '#193d4b' }); // Local override.
first.part('dot').reset('fill'); // Link this property back to the definition.
```

A named part keeps the same handle through supported component edits, so references to that part remain valid. Shared definition edits update properties that an instance has not overridden, while values controlled by data retain their owner. Calling `reset()` on a local override reconnects that property to the shared definition, as the dot example shows. The current component definition is a tree of shapes and properties rather than a schema that automatically exposes every parameter.

## Bring data to the drawing

A repeated collection creates one component instance for each data row. The key identifies which row an instance represents, allowing the same object to survive a reorder or value change instead of being replaced on every update. This example reuses the `tile` definition above and binds each dot's radius to the row's `value` field.

```js
const data = drawing.data([
  { id: 'north', value: 20 },
  { id: 'south', value: 40 },
], { key: 'id' });
const marks = drawing.repeat(tile, { data });
marks.bind('dot.r', {
  field: 'value',
  scale: { domain: [0, 100], range: [2, 20], clamp: true },
});
marks.layout({
  type: 'grid', columns: 4, cellWidth: 64, cellHeight: 64,
  gap: 16, padding: 24, responsive: true,
});
marks.instance('north').part('label').set({ text: 'North' });
data.replace([{ id: 'south', value: 30 }, { id: 'north', value: 60 }]);
```

A data replacement checks every subscribed built-in collection update before adopting the new rows. Rows with surviving keys keep their object identity and compatible local overrides, while removed handles reject later edits. If keys are duplicated, a bound field is missing or capacity is exceeded, the previous source remains intact. The source copies and freezes its data, rejecting empty array slots, getters, executable values and unsafe keys before those values become part of the scene.

Application-defined prepare/commit hooks run as trusted integration code. They are not a transaction sandbox for arbitrary callbacks, so callers should not infer that the built-in collection guarantees make untrusted JavaScript safe to execute.

Collection layout owns instance x and y positions while it arranges the repeated objects. A grid can reduce its column count to fit the supplied width, whereas a stack uses one column, with cell dimensions and gaps staying fixed. If the required cells exceed either the width or height, `LAYOUT_OVERFLOW` reports the space needed. Give each cell enough room for its actual shapes and labels because this layout does not measure arbitrary text or move overflowing content to a later story moment.

## Give an arm a target

A two-bone rig connects two segments and calculates the joint position needed to reach a target. The scene adapter supplies parameters for moving that target, so a slider can pose the same arm that an animation uses. This example adds the rig to the existing `drawing` scene and gives the target's y value a labeled control.

```js
import { twoBoneRig } from 'explainerkit/rigs';
const arm = twoBoneRig(drawing, {
  lengths: [120, 80], root: { x: 240, y: 140 },
  target: { x: 120, y: 80 },
});
drawing.control(arm.target.y, { label: 'Target height', step: 1 });
arm.group.part('upper').set({ stroke: '#278b8c' });
```

The target is measured relative to the rig root, with positive y pointing down in the default drawing space. Forward kinematics (FK) calculates positions from specified joint angles, while inverse kinematics (IK) chooses angles that reach a requested target. The `fkTwoBone` and `solveTwoBone` exports provide those calculations for custom drawings as well as the scene adapter.

For a two-link reach, the bend direction selects the side on which the elbow or knee lies. A `pole:{x,y}` request selects the pole's side of the root-to-target line, while a collinear pole keeps the explicit `bend` value. The result reports the bend actually used, so an application can inspect the choice. Unreachable targets can be clamped or reported as errors according to the requested policy.

`stretch` allows both links to lengthen together by a factor from 1–4, with 1 as the default. The result reports the applied factor, and `reachable` uses that stretched reach when describing the result. This two-link helper does not add joint limits, collision avoidance, general chain solving, mesh skinning or dynamic secondary motion. The rig guides describe the separate skeleton and skinning tools rather than implying that one helper supplies every articulation feature.

## Capture and transform

A captured frame stores a validated, immutable snapshot that can be compared with another frame. `createTransition(from,to,{discrete:'end'})` matches their stable object IDs once and returns `sample(progress)` for progress in `[0,1]`. Matching objects must keep their types and parents, and paths must have the same sequence of command types. Within that structure, numeric geometry and compatible path coordinates interpolate while text and paint switch at the chosen boundary.

This operation calculates frames without changing a scene or deciding how an object should be added, split or merged. Use explicitly authored [fades and shape partitions](modules/shape-operations.md) when the explanation needs those changes, because automatic matching of their intended meaning is unsupported. The proposed `scene.state` and `scene.transition` convenience methods are not implemented. Captured frame dimensions also remain the authored dimensions rather than automatically solving a new responsive layout.

## The player and the page

Mounting connects the existing scene to an element and creates its browser player. `await drawing.mount(container,{renderer,responsive,height,pixelRatio,controls,reducedMotion})` chooses how that view is drawn and controlled, while the scene continues to own its objects and sampled values. SVG and Canvas receive the same supported frame, with Canvas also supplying a text alternative for assistive technology.

For responsive width, use a padding-free mount container because sizing is based on its measured bounding box. Height can be a fixed number or a trusted function of width, and a zero-width container waits until resizing gives it a measurable size. These rules make the container's role explicit rather than treating every hidden or padded element as an immediately usable stage.

Use `play()` and `pause()` to control playback, `seek(seconds,{reset=true,source='manual'})` to choose a time and `refresh()` to redraw after a relevant change. The properties `time`, `duration`, `playing`, `disposed`, `driver`, `frame` and `element` expose the player's current state. Subscribe through `on(name,callback)` to `frame`, `seek`, `play`, `pause`, `interact`, `error`, `dispose`, `driver` or `motionBlocked`, and keep the returned unsubscribe function when the listener needs to be removed.

Call `dispose()` when the view is removed because disposal releases owned DOM, listeners, observers and animation requests and is terminal for that player. Callback failures report `CALLBACK_FAILED` without preventing cleanup. A failed seek restores time and parameter overrides, and a rendering failure retains the previous displayed frame when validation fails before drawing starts. These behaviors distinguish a rejected change from a successfully displayed new moment.

Scrolling can drive the same player instead of autoplay. Create the `.scroll-region` element with enough height to provide a scroll interval, and use CSS for any sticky stage positioning. Attaching the adapter below pauses autoplay and gives scrolling exclusive control of the player's time until the adapter is disposed.

```js
import { attachScroll } from 'explainerkit/scroll';
const scroll = attachScroll(player, {
  element: document.querySelector('.scroll-region'),
  chapters: [0, 50, 100, 150, 200, 250, 300],
  onError: error => console.error(error.code, error.message),
});
// Later:
scroll.dispose();
```

The scroll adapter maps movement through the region to the existing timeline in either direction. It combines pending scroll events and observes resize, while the default travel interval is the region's height minus the viewport height. Optional `start` and `end` values are pixel offsets, and a zero-length interval selects an explicit cut instead of a travel animation. With reduced motion, the default chooses the last chapter reached.

Disposing the adapter cancels pending work and returns manual playback or seeking to the player. Scheduled failures release timeline ownership before reporting an error, whereas an explicit `refresh()` throws synchronously. Parameter edits remain temporary because the next changed scroll sample resets them to the values appropriate for that moment.

## Boundaries worth knowing

The core checks supplied data and rejects unsupported operations without evaluating code provided as text. SVG import accepts its documented subset without automatically loading network resources, while the preload queue needs explicit startup and an allowed-origin policy. Optional solid rendering similarly requires a Three.js copy supplied by the application. These boundaries make resource acquisition a deliberate application action.

Bindings and other trusted callbacks still execute as application JavaScript without a sandbox or CPU deadline. Do not pass untrusted code to them, and do not interpret limits on geometry, data, nesting or raster allocation as limits on arbitrary callback execution. The [security guide](security.md) explains those responsibilities in more detail.

Each sample evaluates the relevant scene objects and produces geometry for the selected renderer. SVG reuses DOM elements, while Canvas redraws and combines opacity through offscreen layers within its resource limits. Clips, gradient alpha masks, text presentation and outline imports work within their linked contracts, but they do not establish a general rich-text or worker-execution system.

[Versioned project recipes](modules/projects.md) can serialize their supported subset rather than every possible runtime object and callback. More extensive caching, dependency invalidation, worker execution and rich-text layout remain work, as described in [current status](foundation-status.md). When you assess an operation's speed, use benchmarks recorded for the source revision and environment you are evaluating.

## Move the view, keep the model

A camera changes which part of the construction is visible without moving the model's own geometry. Framing a region can introduce an area of interest, and following a handle can keep a moving subject visible while its original coordinates remain intact. The example assumes `body` is an existing handle in the `drawing` scene.

```js
const camera = drawing.camera();
camera.zoomTo({ x: 200, y: 100, width: 240, height: 160 }, {
  at: 2, duration: 1.2, padding: 24,
});
camera.follow(body, { at: 5, until: 12, rotation: true });
```

The first `drawing.camera()` call creates the scene's camera and later calls return that same camera. Its default view leaves the drawing unshifted, unrotated and unscaled, including after viewport resizing. A camera position names the world point placed at a viewport anchor, with the viewport center and anchor `(0.5,0.5)` as the defaults. Positive camera rotation turns the visible view in the opposite direction, while time uses seconds, angles use radians and positive zoom is limited to `[0.0001,10000]`.

The camera uses the same property ownership rules as artwork. `camera.set({x,y,zoom,rotation})`, `to(at,patch,{duration,ease})` and `bind(property,{inputs,map})` therefore validate the requested change before applying it, and a multi-property edit applies all its values or leaves the previous values intact.

Use `frame(region,{padding,rotation})` to fit a world rectangle immediately, or `zoomTo(region,{at,duration,padding,rotation,ease})` to schedule that fit as a pan and zoom. Region dimensions must be positive, and padding is measured in screen pixels so the fit can be recomputed for the actual viewport. Framing shots hold their endpoints, must be chronological and are limited to 64. `clearFraming()` releases that framing policy.

`follow(handle,{rotation,offsetX,offsetY,rotationOffset,at,until})` tracks the object's sampled world origin, including movement inherited from parents. Position following is exact, while optional rotation following aligns with the target's transformed local +x direction. Offsets are world-space distances, and the interval includes its start but excludes its end. `unfollow()` restores the underlying authored camera pose, while position or rotation tracks cannot compete with an active follow operation.

An overlay stays above the world drawing in screen coordinates. `overlay(handle)` places a top-level object and its children in that space, and `removeOverlay(handle)` returns them to the world view. An overlay cannot itself be a camera-follow target.

`worldToScreen(point,{time,width,height})` and `screenToWorld(...)` convert positions through the same view used for rendering. For actual pointer input, prefer the inverse transform from `player.view` because it corresponds to the last frame that was successfully displayed.

Sampling before and after the camera serves different inspection tasks. `drawing.sampleWorld()` returns unprojected geometry, `sample()` returns the frame after the view transform and `sampleView()` returns both as `{frame,view}`. The view includes the camera pose, affine transform, inverse transform and IDs of screen-overlay roots, allowing input conversion to use the same geometry that produced the image.

The camera consumes one node from the scene budget and reports errors for missing follow targets, singular target transforms, impossible fits or excessive projected translations. It does not change model geometry or add forces associated with rotating physical reference frames. Damped pursuit and automatic image-feature tracking remain work, while the separate [3D spatial cameras](modules/spatial-three.md) keep their own documented contracts.

A film camera shot preserves one authored spatial relationship while fitting it into the available space. Adaptive restacking is therefore suspended for that camera scene because moving objects into independent layout blocks would change what the camera is following. Pointer conversion reverses the viewport fit and then the camera transform, while overlays skip the camera inverse and HTML controls remain outside both transforms.

## Playback and film lifecycle

Scene players and films use the same clock implementation in `src/player/clock.js`. Sampling and rendering must succeed before the clock adopts a new time, so a playback failure preserves both the previous timestamp and displayed frame. A change to reduced-motion preference pauses ongoing playback, and an attached scroll driver retains control until it is detached. These rules keep the displayed moment and the player's reported state consistent.

The film factory returns a controller with `play`, `pause`, `seek`, `refresh`, `dispose`, `on`, `setDriver` and `reportError`, together with the properties `time`, `duration`, `playing`, `disposed`, `scene`, `frame` and `view`. That controller can be passed directly to `attachScroll`, allowing a film to use the same time-driving relationship as a mounted scene.

Disposing the film releases its owned DOM, renderers, observers, listeners, caption timers, speech and pending frames. Mounting another film in the same document disposes the previous film, and a paused film redraws only after input or invalidation rather than keeping a render or cursor loop alive. The application should still dispose the active view when it is removed.

A scene's duration includes the completion of entrances, exits and dimming so those authored changes are not cut short by the clock. A `to()` continuation starts from preceding tracks, including tracks created with `animate()`, and rejects an earlier insertion with `AMBIGUOUS_CONTINUATION` when that insertion would change an inferred starting value. Multi-property moves prepare every affected track before adopting any of them, and collection layout is calculated before the instance's entrance offset is added.

## Articulation, morphs and perceptual grouping

Joint posing, outline changes and grouping operate on the scene's existing objects rather than introducing another clock. The following imports select the relevant calculation, while the linked guides explain its prerequisites and supported inputs.

| Import | Working functions | Guide |
| --- | --- | --- |
| `explainerkit/rigs` | `skeleton`, `skeletonRig`, `bindSkin`, `solveRigGoals`, `splineRig` | [Bones/skin](modules/rigs-morphing-perception.md#pose-a-skeleton), [multiple goals, priorities, poles and curve rigs](modules/advanced-rigs.md) |
| `explainerkit/morph` | `createMorph`, `flattenPath`, `createCompoundMorph`, `colorInterpolator`, `createSceneTransition` | [Single contours](modules/rigs-morphing-perception.md#morph-an-outline), [compound forms, paints and entering/exiting](modules/advanced-constructions.md) |
| `explainerkit/parallax` | `parallaxRig`, `depthFor`, `speedFor`, `coverage`, `fitBackdrop`, `storyPins`, `storyRate`, `connectParallax`, `auditParallax` | [Depth layers for scroll stories, with checks](modules/parallax.md) |
| `explainerkit/layout` | `place`, `attach`, `inkFor`, `paragraph`, `wrapText`, `panel`, `pathPoint` (and `scene.locate`) | [Place objects, attach labels and fit text](modules/compose.md) |
| `explainerkit/audit` | `auditScene`, `auditFrame`, `frameMarks`, `contrastRatio`, `RULES` | [Check collisions, contrast and composition](modules/composition-audit.md) |
| `explainerkit/perception` | `perceptualGroups`, `groupStagger` | [Review and override suggested groups](modules/rigs-morphing-perception.md#suggest-a-perceptual-group) |

A solved pose can be stored as a derived scene input, allowing several bone or artwork bindings to use the same result. A morph or skin sampler similarly supplies path commands for an ordinary `commands` binding. Grouping helpers instead return proposed groups together with their reasons and onset times, leaving the application to decide whether the suggestion matches the explanation.

The default `createTransition` requires matching object IDs, types, parents and path-command sequences, which makes its interpretation explicit before interpolation begins. Choose `paths:'morph'` to interpolate different outlines or `colors:'srgb'|'linearRGB'` to interpolate colors under the selected color rule. A compound morph matches contours by their declared names, and `createSceneTransition` can fade unmatched objects in or out. None of these operations infers how one meaningful object should split or merge, and grouping suggestions do not silently change rig structure, object identity or scientific time.

## Construct, map and reveal

Geometry, data and paint describe different parts of the same construction. Geometry creates paths, data maps values onto drawing properties, and graphics descriptors determine where paint appears. Select the module for the operation needed by the scene rather than treating every change as a new shape type.

| Import | What you can do | Reference |
| --- | --- | --- |
| `explainerkit/geometry` | Shape paths, path transforms/measurement/trim, grid/radial/path placements | [Procedural geometry](modules/advanced-constructions.md#construct-the-form) |
| `explainerkit/data` | Map values through `scale`, `bandScale` and `ordinalScale`, then generate ticks, transform rows or build plot paths and axis definitions. Summary, binning, stacking and unit-conversion helpers are also available. | [Data modeling](modules/data-modeling.md) |
| `explainerkit/graphics` | `clipRect`, `clipCircle`, `clipPath`, `linearGradient`, `radialGradient` | [Clips, fill rules and paint](modules/graphics.md) |

When binding a repeated collection, `bind(path,{field,scale})` can use either a linear-scale options object or a trusted mapping returned by `scale` or `bandScale`. The collection validates every mapped property before replacing the data, so a failed mapping leaves the rows and surviving object IDs unchanged. The mapping callback remains application code rather than a portable or sandboxed formula.

A clip declares which part of local artwork remains visible, while a fill rule describes how a path's contours determine its interior. Shapes and groups accept `clip:null|descriptor` and `fillRule:'nonzero'|'evenodd'`, with `fill` and `stroke` accepting captured local gradients as well as supported colors. Those descriptors can be bound like other properties, survive frame capture and render through SVG or Canvas under their respective contracts.

Nested clips intersect, and group opacity applies after its children have been combined. The [look module](modules/look.md) adds gradient alpha masks, blur and glow, while [shape operations](modules/shape-operations.md) change actual geometry through cutting and partitions. Those are distinct operations, and imported assets remain subject to their format and resource limits instead of becoming unrestricted SVG or media execution.

A live source can supply an external observation to the same scene parameters used by authored motion. The [input module](modules/live-inputs.md) requires an explicit `start()` so importing a module or playing a scene does not turn on a camera, microphone or sensor. Video analysis and AR tracking are outside the implemented acquisition and binding tools.


## Extend the same construction

The [module map](modules/index.md) connects specialized tasks to their guides and limits. These tools extend a construction through another calculation or rendering choice, while its ordinary scene objects retain their parameters and authored time.

| Import | What you can do | Guide |
| --- | --- | --- |
| `explainerkit/zoom` | Use nested coordinate systems, animate large zoom changes and crossfade between adjacent detail levels | [Deep zoom and detail](modules/deep-zoom.md) |
| `explainerkit/spatial` | Position and rotate 3D geometry, project it through a camera and test ray intersections. Matrix and quaternion helpers support those calculations. | [Spatial constructions](modules/spatial-three.md) |
| `explainerkit/renderers/webgl` | Draw points and lines with WebGL2 and control the appearance of each point from its center to its edge. | [WebGL buffers](modules/webgl-points.md) |
| `explainerkit/renderers/three` | Render solid, lit 3D objects using a Three.js module imported and supplied by your application | [Adapter contracts](modules/renderer-contracts.md) |
| `explainerkit/geometry/shapes` and `explainerkit/morph` | Combine, intersect or subtract outlines with `booleanPath`, or use convex cuts and piece tools to split, merge or transition between matched shapes. | [Shape operations](modules/shape-operations.md), [film kit](modules/film-kit.md#cut-any-outline) |
| `explainerkit/physics` | Analytical springs, custom spring easing, inertia and captured release velocity | [Stroke, springs and paths](modules/stroke-springs-paths.md) |
| `explainerkit/particles` and `explainerkit/mechanisms` | Sample repeatable particles and noise at a chosen time, or calculate relationships between gears, rolling objects, slider-cranks and belts. | [Particles and mechanisms](modules/particles-mechanisms.md) |
| `explainerkit/adapters/dom` and `explainerkit/typography` | Apply scene values to existing HTML elements and animate words or reader-perceived characters (graphemes) on the same timeline. | [DOM and typography](modules/dom-typography.md) |
| `explainerkit/import/svg`, `explainerkit/import/font`, `explainerkit/import/gltf` | Safe local SVG, static TrueType outlines and static triangle geometry | [SVG](modules/svg-import.md), [font outlines](modules/font-outlines.md), [glTF](modules/gltf-import.md) |
| `explainerkit/look` | `glow`, `alphaMask`, `gradeFrame` (saturation, exposure, contrast, tint, duotone), `filmGrain`, `shadowOnPlane`, `shadowOnWall` | [Look and its rendering limits](modules/look.md) |
| `explainerkit/characters` | Rigged starter cast (bean, stick, bird, fish, microbe), face rig, speech, walks and poses, editable SVG packs | [Characters](modules/characters.md) |
| `drawing.cloud` | Draw point clouds in an ordinary scene through Canvas with WebGL2 and a CPU fallback, or through SVG with up to 5,000 points. | [Film kit](modules/film-kit.md#draw-a-hundred-thousand-points) |
| `explainerkit/story` and `explainerkit/assets/preload` | Divide a scroll story into sections and holds, and preload upcoming files within resource limits. | [Story and delivery](modules/story-delivery.md) |

`drawing.space({camera})` turns supported 3D geometry into ordinary scene paths that share the existing parameter bindings and timeline. Its CPU calculation clips line geometry to the camera's visible volume, called the frustum. When surfaces provide normals describing their facing direction, the view can fade or hide their far side, and `order:'depth'` can reorder objects every frame. This facing test does not remove every line hidden by another object, as explained in the [film kit](modules/film-kit.md#depth-far-sides-order-and-a-rolling-map).

Detail levels solve a related visibility problem at different zoom distances. `detail(drawing,...)` from `explainerkit/zoom` creates those levels in the same scene, then transitions between their visibility. Hidden levels remain in memory because this is not an asset-streaming or eviction system. Use the linked guides for the complete signatures and their coordinate limits.

A scene grade adjusts sampled colors without editing the source artwork. `drawing.grade({saturation,exposure,contrast,tint,tintAmount,shadows,highlights,duotone})` applies to paints, gradient stops, glow colors and cloud point colors, using numbers or inputs from the same scene. It operates before compositing rather than processing a completed high-dynamic-range (HDR) image.

Grain is a separately chosen overlay. `filmGrain({width,height,size,intensity,rate,seed})` returns reproducible `pixels(time)` or `blueprint(time)` output, leaving the caller to choose the drawing time and layer. Keeping the overlay explicit makes its memory and composition cost part of the application's rendering choice.

Check the relevant guide before treating a format name as unrestricted support. SVG import reads its supported geometry without executing arbitrary content, while font outlines support kerning and variable axes without the complete text shaping needed by every writing system. Outline operations approximate curves with straight segments within a stated tolerance. Likewise, a story hold changes how scrolling maps to story time without automatically altering scientific model time. Each limit belongs to the operation being used rather than to a generic promise that every explanation will work.

## Film craft and delivery

Film tools connect appearance, timing and output to the existing scene. Choose a light or depth layer when the picture needs it, a media driver when audio/video must own time, and export tools when the sampled frames need to become files. The table links each of those choices to its current guide without requiring the example-specific story to become runtime policy.

| Entry point | Behavior and limits | Guide |
| --- | --- | --- |
| `drawing.light({angle,color,ambient})`, shape/group `shade` | Shade flat artwork with one directional light, using scene inputs for shadow, light, rim and highlight controls. | [Rendering](modules/film-rendering.md) |
| `drawing.layer({depth,bounds})`, `drawing.focus({depth,aperture})` | Create top-level layers with fixed clipping bounds and depth-dependent movement or focus blur. Canvas can reuse their cached images within its resource limits. | [Depth](modules/depth-layers.md) |
| `lag`, `jiggle`, `squashStretch` from `explainerkit/physics` | Evaluate a bounded interval of past input to add delayed following, oscillation or area-preserving squash/stretch. | [Secondary motion](modules/secondary-motion.md) |
| `drawing.motionBlur({samples:6,shutter:.5,fps:60})` | Average several moments into one image for Canvas/export. Set shutter width with a number or scene input and optionally restrict blur to motion above a screen-space threshold. SVG/Three reject positive exposures | [Rendering](modules/film-rendering.md) |
| `texture(spec)` from `explainerkit/graphics` | Seeded grain/paper/halftone/hatch fill or `texture` overlay, shape/screen coordinates | [Rendering](modules/film-rendering.md) |
| `lattice(drawing,commands,options)` from `explainerkit/geometry` | Move a grid of scene parameters to bend a path in its local coordinates | [Deformation](modules/deformation.md) |
| `importSVG` | Convert supported SVG shapes, gradients, clips, masks and filters into scene objects, within the importer’s format and resource limits | [Design SVG](modules/svg-design-import.md) |
| `cubicBezier`, `handle.keys(property,keys)`, `parameter.keys(keys)` | Set easing for each keyframe segment and validate all segments before changing tracks. Use `.replaceKeys` to replace authored keys | [Keys](modules/keyframes.md) |
| `attachMedia` from `explainerkit/media` | Drive the player or film from an audio/video element’s `currentTime` while synchronizing seeking, playback speed and cleanup. | [Media](modules/media-clock.md) |
| `npx explainerkit-export-film --url URL --out NEW_FOLDER` | Capture each frame at a specified index, with optional ffmpeg encoding. | [Export](modules/export-film.md) |
| `createTimeline` from `explainerkit/editor/timeline` | Edit numeric keyframes and cubic easing curves with accessible controls, using the existing player and animation tracks | [Timeline](modules/timeline.md) |

Scene light is authored in world coordinates, and camera rotation transforms that direction into the displayed view. Rotating the artwork therefore preserves the light's relationship to the world rather than rotating the illumination with the object. A depth value of 1 reproduces the ordinary camera, while layer children can still use the existing local-coordinate and zoom bindings.

Focus and motion blur keep the renderer's processing limits, including the output ceiling of 8,294,400 raster pixels. Default durations and effect amounts are artistic conventions rather than measured laws of physics or perception, so choose them for the intended explanation and check the resulting output.

## Character production additions

Audio-aligned mouth cues are timing data prepared outside ExplainerKit. `speechFromRhubarb(json,{at?,blend?})` from `explainerkit/characters` validates the A–H/X cues and returns an immutable timeline that can be sampled at a chosen moment, while `character.lipSync(json,options)` applies it to an actor. Text-based `say()` remains the default when no such analysis is provided.

Character appearance and secondary motion are explicit options. `shade:true` requests native scene shading, a shade descriptor specifies its controls and `null` selects flat base colors. `secondaryMotion:false` disables the supported bun and bird-tail followers. Blink and eye-dart schedules remain reproducible through 24 hours of scene time with bounded caches, and [character production controls](modules/character-production.md) explains the units and limits for these choices.
