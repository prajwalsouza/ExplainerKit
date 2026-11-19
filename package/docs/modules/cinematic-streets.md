# Cinematic streets from map data

A cinematic street is a real place rebuilt as a 3D scene: the buildings stand on their mapped footprints, the roads have their mapped widths, and the weather, the time of day and the camera are yours to direct. Two modules do the work. `explainerkit/procedural/city` turns parsed map data into geometry and placement, and imports no renderer. `explainerkit/renderers/three/city` draws that model with a Three.js module you supply, and adds the ground, water, sky, light, rain and snow.

The map data comes from OpenStreetMap through `explainerkit/maps/osm`, which the [map data guide](map-data.md) explains. Every result built from it must show the credit "© OpenStreetMap contributors", and a city model carries that text in `attribution` so a page can display it.

## Build a model of a street

`buildCity` takes the result of `parseOverpass` and returns a city model. The example assumes `text` holds an Overpass answer for a few blocks, which you downloaded or read from a file.

```js
import {parseOverpass} from 'explainerkit/maps/osm';
import {buildCity} from 'explainerkit/procedural/city';

const osm = parseOverpass(text, {bbox: {south: 52.364, west: 4.887, north: 52.3668, east: 4.8935}});
const city = buildCity(osm, {seed: 7, style: 'auto', season: 'summer', people: 1});
console.log(city.stats, city.style.name, city.attribution.text);
```

The same data and the same `seed` always give the same model. Coordinates are metres with x east, y up and z south, so a map point `(x, y)` stands at `(x, height, -y)`. A model is refused above 3,000 metres on a side, 20,000 buildings, 60,000 street objects, 400,000 plants or 6,000,000 vertices.

The model holds the parts that a renderer needs.

| Field | What it holds |
| --- | --- |
| `meshes.walls`, `meshes.roofs`, `meshes.trim` | Triangle meshes with positions, normals, sRGB colours and extra numbers per vertex. Walls carry their bay and floor layout, which is how a renderer draws windows and knows which to light. |
| `fine` | Railings and other small building parts, grouped into 48-metre tiles so that distant tiles can be left out. |
| `field` | The street field: for every cell of a grid, the distance to the nearest kerb, centre line, path, water, grass and wall. The ground is shaded from it. |
| `props` | Repeated objects such as lamps, trees, cars and benches. Each has a mesh, a distance class in `range`, and eight numbers per placed object: position, turn, size and tint. Trees also carry a simpler `far` mesh. |
| `cover` and `coverMeshes` | Grass, tall grass, ferns and flowers, grouped into 32-metre tiles. |
| `people` | Walking routes, the walkers, and the figures they are drawn with, each with its look and a simpler far version. It is empty unless you ask for people. |
| `lights` | Where each lamp head hangs. |
| `styles` | One entry per building, saying which material, windows and roof were chosen and which of those values were made up. |

### What comes from the map and what is made up

OpenStreetMap supplies building footprints and road geometry. Heights, floor counts and facade details depend on what contributors mapped. The kit fills gaps with defaults chosen from the seed. A building's entry in `city.styles` lists those choices in `inferred`, and `city.stats.inferred` counts them for the model. Mapped objects provide placement cues. For example, the generator skips tree positions that overlap a road or surface track.

Objects that the map does not record are added by rule, and each rule can be switched off through `infer`.

| `infer` key | What it adds when true |
| --- | --- |
| `lamps` | Street lamps along roads where the map has fewer than one per 90 metres. |
| `trees` | Street trees where pavements are wide enough, trees in parks and woods, and a few in back gardens. |
| `cars` | Parked cars along the kerbs of ordinary streets, in runs with gaps. |
| `bikes` | Bicycle racks with bicycles, and a bicycle leaning on some lamp posts. |
| `furniture` | Bollards and signs at corners, bins, cabinets, post boxes, planters, bus shelters, benches by paths and café tables outside some shops. |
| `boats` | Small boats moored along quays. |
| `plants` | Grass, ferns and flowers in green areas and gardens and round the foot of street trees. |

`detail: 'massing'` leaves out trim and every street object, which gives a plain block model. `density` scales how many plants are placed, from 0 to 4. `people` is off by default. Pass `true` or a number from 0 to 6 to set how busy the pavements are, or an object that also says how the walkers are dressed, which [Walkers and their clothes](#walkers-and-their-clothes) explains.

### Regional styles

A style is a bundle of choices that makes a street look as if it belongs somewhere. It sets which wall colours and materials are common, what the pavement is made of, which lamps, bollards and post boxes stand on it, which trees line it, which cars are parked, and which side of the road people drive on. The built-in styles are `dutch`, `nordic`, `british`, `mediterranean`, `central`, `american` and `modern`.

With `style: 'auto'`, the default, `regionStyle(lat, lon)` picks a style from rough boxes of latitude and longitude. The boxes do not follow borders, so the choice is a starting point, and `city.style.inferred` is true to mark it as a guess. Name a style to choose it yourself, or pass a base and overrides.

```js
const city = buildCity(osm, {style: {base: 'mediterranean', cafes: 2.5, shutters: 0.9}});
```

`CITY_STYLES` lists every field of every style. `palette` still overrides the style's wall colours alone, with one of `temperate`, `brick`, `pastel`, `mediterranean` or `modern`.

### Walkers and their clothes

With `people: 1` every walker is the same plain figure, an adult in a sweater and trousers, recoloured per walker. That default needs no choices and works in any scene. To dress a crowd for its scene, pass an object instead of a number.

```js
const city = buildCity(osm, {
  season: 'winter',
  people: {density: 1.2, clothing: 'auto', weather: 'snow', variety: 0.7},
});
```

`density` is the number from before, 0 to 6. `clothing: 'auto'` chooses each figure's clothes from the weather, the season and the regional style. In snow or cold most people wear coats and boots, many wear beanies and scarves, and some put their hoods up. In rain they wear raincoats or put up umbrellas. A summer day brings T-shirts, shorts, skirts and dresses, and a colder style such as `nordic` dresses warmer than `mediterranean` in the same season. `weather` is a name from `WEATHER` or a condition object. Name the same weather that the scene is drawn in, because the model does not know it otherwise.

Four more numbers shape the crowd. `variety`, from 0 to 1, says how far the choices may stray from the likeliest outfit. At 0 everyone wears the likeliest outfit, and at 1 an occasional unlikely one appears. `variants`, from 1 to 32, is how many different figures the crowd is drawn from, 16 by default. `wear` fixes any field of every look, for example `wear: {umbrella: true}`. `clothing` may also be one look or a list of at most 32 looks, which replaces the automatic choice.

A look is a plain object, and `personLook` fills in every field you leave out. The table lists its fields.

| Field | Values |
| --- | --- |
| `age` | `child`, `adult` or `older`, which set the defaults for the body numbers below |
| `height` | Metres, from 0.9 to 2.1 |
| `build`, `shoulders`, `hips`, `legs`, `head` | Factors round 1 that widen the body, the shoulders and the hips, lengthen the legs and enlarge the head, within the ranges in `personRanges` |
| `top` | `tshirt`, `shirt`, `sweater`, `jacket`, `coat` or `raincoat` |
| `sleeves` | How far the sleeves reach, from 0 (none) to 1 (the wrist) |
| `tucked` | Whether a T-shirt or shirt is tucked in |
| `collar` | Whether the top has a collar |
| `bottom` | `trousers`, `shorts`, `skirt` or `dress` |
| `length` | How far shorts, a skirt or a dress reaches, from 0 to 1 |
| `shoes` | `shoes` or `boots` |
| `hair` | `short`, `cropped`, `bob`, `long`, `ponytail`, `bun`, `curly` or `bald` |
| `hat` | `none`, `beanie`, `cap` or `brim` |
| `hood` | `none`, `down` or `up` |
| `scarf`, `umbrella`, `gloves` | True or false |
| `bag` | `none`, `backpack`, `shoulder` or `hand` |
| `colors` | Any of `top`, `bottom`, `skin`, `hair` and `accent`, as library colours. The accent colours the hat, scarf, bag and umbrella. A colour left out is chosen for each walker. |

```js
const city = buildCity(osm, {people: {density: 1, clothing: [{top: 'raincoat', hood: 'up'}, {bottom: 'dress', hair: 'bun'}]}});
```

The figure is one continuous skin. The trunk, arms, legs, neck, head, hands and feet are built as connected rings, and neighbouring parts share their vertices at the shoulders, elbows, wrists, hips, knees and ankles. Every vertex names one joint and carries a weight that rises from 0 above the joint to 1 below it. The vertex turns about the joint by that share of the joint's angle, so a bending knee or elbow curves the tube, and no gap opens at any point of the stride. Clothes are further rings of the same build, pushed out from the skin by the thickness of the cloth and bound to the same joints with the same weights, so a sleeve or a trouser leg moves exactly with the limb inside it. Skirts, dresses and long coats hang free from the hips. A leg that swings forward pushes the hem out in front of it, and the hem sways with the stride, so the leg never cuts through the cloth. Hair, hats, hoods, scarves, bags and umbrellas are built and bound in the same way.

`personAsset(look, seed)` returns one figure: its `mesh`, a simpler `far` mesh, its `rig`, which gives the height of each joint, and its full `look`. A near figure holds at most 3,000 triangles and a far one at most 1,200, the limits in `personBudget`. The renderer swaps in the far figure beyond the `peopleNear` distance of the quality step. `personWardrobe` is the automatic choice on its own, and `personClimate` returns the three numbers it dresses for: `cold`, `rain` and `snow`, each from 0 to 1.

### Walkers are a function of time

A walker is a route, a starting point, a pace and a look. `walkerPose(city, index, time)` returns where that walker stands at a time in seconds, with its heading, the point in its stride, the length of its current step and its current speed. Walkers go to the end of their route, turn round and come back. The answer depends only on the time, so a shot can be scrubbed backward or rendered one frame at a time and the walkers land in the same places.

No two walkers move alike. Each has its own pace, step length, arm swing and lean, and older walkers walk slower with a shorter swing. The pace wanders a little round each walker's own speed, some walkers stop for a few seconds now and then, and each drifts slowly from side to side on the pavement. Each of these is a formula of the time alone, with no state carried from one frame to the next, so a shot stays seekable. A walker who slows takes shorter and slower steps, each as long as the ground it covers, so the planted foot never slides. A walker who stops stands with both feet together. Two numbers in the `people` object set the amount. `noise`, from 0 to 1 with a default of 0.6, scales the differences between walkers. `pauses`, from 0 to 1 with a default of 0.25, is roughly the share of walkers that stop now and then. `gait` sets the way of walking. With `'auto'`, the default, each walker gets a way of walking chosen from its look and the weather, such as a stroll, a brisk walk or a shuffle. A name from `personGaits`, or an object with a `style` name and any of `pace`, `step`, `swing`, `lean` and `pauses` to adjust it, gives everyone the same one. With `noise: 0`, `pauses: 0` and one named `gait`, walkers with the same figure all move alike.

To draw one figure outside a street, for a close-up or a test, pose its mesh yourself. `personMotion(look, {seed, index, gait})` gives the walker's speed in metres per second, its step length, arm swing and lean, and the `scale` the figure is drawn at. `personPose(phase, {step, swing, lean}, rig)` turns a point in the stride into joint angles. The `phase` is in radians and advances by π with every step, and the step length is in the figure's own metres, so divide it by `scale`. `posePerson(mesh, pose, rig)` then returns the posed vertex positions of the figure from `personAsset` as a new array, placed exactly as the renderer's shader places them. The demo at the end of [Vehicles](#vehicles) walks figures on the spot this way.

Set `people.activities` to `'mixed'` to add people who walk in pairs, talk in groups, wait or browse shop fronts. The model looks for pavement with enough room to stand and shop fronts with space to browse. People walk when the map lacks a suitable spot. The default, `'walk'`, gives everyone a walking route.

```js
const city = buildCity(osm, {
  people: {density: 2, clothing: 'auto', activities: 'mixed'},
});
```

For a custom mix, supply an object with relative weights from 0 to 1 for `walk`, `talk`, `stand` and `browse`. Set `pairs` to the fraction of walking selections that try to place two companions, and use `groupSize` to cap a talking group at 2 to 6 people. Omitted settings use the values in `PERSON_ACTIVITIES`. The `activity` returned by `walkerPose` identifies what the person is doing, and `arms` and `head` describe the gesture drawn by the renderer. Seeking to a time also reproduces those gestures.

### Traffic that moves

Cars, buses, trams and cyclists drive through a model when you ask for them. Pass `traffic: true` to `buildCity`, or an object of settings, and the model gains a `traffic` field that holds the plan and the vehicle meshes. Traffic is off by default.

```js
import {buildCity, vehiclePose} from 'explainerkit/procedural/city';

const city = buildCity(osm, {traffic: {cars: 1.5, buses: 1, trams: 1, bikes: 1, variety: 1}});
const pose = vehiclePose(city, 0, 12.5);
```

The plan turns roads into lanes between junctions, on the side of the road that the regional style drives on. Tram tracks become tracks, and cycle paths become one riding line each way. Everything is cut at the edge of the model, where vehicles leave and later come back in. A driver keeps a gap to the vehicle ahead that grows with speed, slows for bends, waits its turn at a junction and stops at signals that run on a fixed cycle. Buses and trams dwell at the stops the map records. At the end of a lane a driver prefers to carry straight on and avoids the turn with the longest queue. Cars drive only on carriageways, never on footways, paths or cycle paths, and riders keep to cycle paths.

| Setting | What it does | Range | Default |
| --- | --- | --- | --- |
| `cars`, `buses`, `trams`, `bikes` | How many of each kind run, where 1 is typical and 0 is none | 0 to 4 | 1 |
| `speed` | Scales every speed limit | 0.1 to 3 | 1 |
| `headway` | The time gap in seconds a driver keeps to the vehicle ahead | 0.5 to 6 | 1.4 |
| `signalCycle` | The length of one signal cycle in seconds | 10 to 240 | 36 |
| `variety` | How much drivers and riders differ in pace, gap, pull-away and drift in their lane, from 0 (identical) to 2 | 0 to 2 | 1 |

A road without a speed limit on the map uses `DEFAULT_SPEEDS` for its class, for example 30 km/h on a residential street. `parkingPlan(road, half, drive)` decides which sides of a street have room for parked cars once the moving lanes are kept clear, and both the parked rows and the lanes follow it, so moving traffic never meets a parked car. A street narrower than about 5.6 metres has no parking.

Vehicles react to one another, so their positions come from a simulation in steps of a tenth of a second from time zero. `vehiclePose(city, index, time)` and `trafficState(plan, time)` still give one answer for one time, whatever was asked before, so a shot can be scrubbed or rendered frame by frame. Asking about a late time costs the simulation up to that time once, and snapshots every four seconds make later questions fast. A plan holds at most 600 vehicles and runs to at most six hours.

### Vehicles

Every vehicle comes from one generator. `vehicleAsset(kind, {look, shape, running, end})` builds a body from the numbers in `VEHICLE_SHAPES`. The kinds are grouped in `vehicleFamilies`: cars (hatchback, saloon, estate, SUV and taxi), work vehicles (van, pickup and box truck), transit (bus, minibus and tram) and cycles (a bicycle with its rider). A pickup and a box truck are a short cab with an open bed or a tall box built behind it.

`look` varies a kind along three dimensions at once, through `vehicleShape(kind, look)`. `size` scales it from 0.8, a small one of its kind, to 1.25, a large one. `era` is `'classic'` (square, upright glass), `'modern'` or `'sleek'` (low and rounded, with raked glass). `ride` raises or lowers the body on its wheels by up to 0.15 metres. `shape` then overrides any single number, such as the length or the wheel radius.

```js
import {vehicleAsset} from 'explainerkit/procedural/city';

const old = vehicleAsset('estate', {look: {era: 'classic', size: 0.9}});
const lifted = vehicleAsset('pickup', {look: {ride: 0.12}, shape: {wheel: 0.42}});
```

A street draws three looks of each kind, chosen by `vehicleLook(kind, variant, seed, style)`, so parked and moving cars differ without one model per car. The regional style sets how often each era appears, and a few taxis, pickups and box trucks drive among the private cars. Wheels turn with the distance driven. Head and tail lights come on with the street lamps and in rain, fog and snow, and the headlights of the sixteen moving vehicles nearest the camera light the road and walls ahead of them as spot lights.

```demo design-city-assets
Choose what to line up. People dressed for the weather shows twelve walkers that `personWardrobe` dressed for the chosen weather. One person in every walking style shows a single walker in each gait, with its speed. Every vehicle kind lists the vehicle families, and Cars by era and size shows each car as classic, modern and sleek, alternately small and large. New draw picks a fresh seed, and the angle slider turns the view.
```

### Check a built place

`auditCity(city, {times})` looks for the kinds of breakage that are easy to miss in a frame. It reports geometry that is not a number, objects inside buildings, in the water, in the carriageway or beyond the edge of the model, boats moored on land, walkers inside buildings, in the water or in the road, and vehicles off the road, inside buildings or inside one another. Walkers and vehicles are sampled at the `times` given in seconds, at most 64 of them.

```js
import {auditCity} from 'explainerkit/procedural/city';

const report = auditCity(city);
for (const issue of report.issues) console.warn(issue.kind, issue.count, issue.message, issue.examples);
```

Each issue has a `kind`, a `count`, a plain `message` and up to twelve example places as model coordinates. `report.ok` is true when nothing was found. The checks sample rather than prove, so a clean report means nothing was found, not that nothing is wrong.

## Weather and time of day

A condition is a plain object of numbers: where the sun is, the colours of the sky and its light, how wet or snowy every surface is, what is falling, and which lights are on. `WEATHER` holds ten of them: `clear`, `golden`, `overcast`, `rain`, `snow`, `fog`, `dusk`, `night`, `nightRain` and `nightSnow`.

`mixWeather(a, b, t)` blends two conditions field by field, with `t` from 0 to 1, and turns the sun the short way round. `weatherSchedule` wraps that in a timeline whose `at(time)` is a pure function of time.

```js
import {WEATHER, weatherSchedule} from 'explainerkit/procedural/city';

const plan = weatherSchedule([
  {at: 0, weather: 'golden'},
  {at: 8, weather: 'rain', change: 3},
  {at: 16, weather: {...WEATHER.night, sun: {...WEATHER.night.sun, azimuth: 120}}},
]);
street.setWeather(plan.at(time));
```

Each change takes `change` seconds and ends at its `at` time. The third step shows that a condition is ordinary data. Copy one and alter it to place the sun where a shot needs it. Sun azimuth is degrees clockwise from north and elevation is degrees above the horizon. Fog `density` is the optical depth at 100 metres: the light kept at distance `d` metres is `exp(-density * (d / 100)^2)`.

```demo design-street-drizzle
Scrub the weather timeline over Westminster, London. Follow the same streets from daylight to rain and watch the street lamps come on as night falls. The wetness and lighting readouts show the values passed to the renderer.
```

## Draw the street

`cityScene` builds the Three.js objects for a model. The library never imports Three, so pass the module namespace as the first argument. The example assumes `THREE` is that module, `renderer` is a `THREE.WebGLRenderer` with shadows enabled, and `camera` is a perspective camera.

```js
import {cityScene} from 'explainerkit/renderers/three/city';

const street = cityScene(THREE, city, {weather: 'golden', quality: 'live'});
scene.add(street.object);
scene.fog = street.fog;

function frame(time) {
  street.update({time, camera, height: renderer.domElement.height});
  renderer.render(scene, camera);
}
```

Call `update` once per frame before rendering. It advances the clouds, rain, snow and walkers to `time`, keeps the sky, the sun's shadow area and the precipitation centred on what the camera sees, and re-sorts objects by distance. Call `setWeather` with a name, a condition or a blend whenever the weather changes, and `dispose` when the scene is no longer needed, which releases every object the function created.

The ground is one surface shaded from the street field. Asphalt, kerbs, paving, paths, grass, lane paint and zebra crossings all come from the same distances, so junctions merge without overlapping strips. `paving` chooses the pavement: `flags`, `clinker`, `setts` or `stone`. By default it follows the model's style.

```demo design-city-drawing
In New York’s Flatiron District, switch between Full street and Building masses. The camera and the mapped layout stay in place. In the simpler model, the road grid and building volumes are easier to see. Switch back to see the street objects and façade detail that the full model adds.
```

Wet roads and water show the street upside down. Each is drawn from a camera mirrored in its plane just before the surface itself, and only when it is visible and needed, so a dry day pays for the water mirror alone. `reflections: false` turns both off.

The colours a city scene writes are linear light, intended for the finishing chain. Set `renderer.outputColorSpace` to `THREE.LinearSRGBColorSpace` and finish each frame with `cinematicPost` from [the cinematic maps module](cinematic-maps.md), which tone-maps, grades and encodes the picture.

### Detail follows distance

Detail is reduced with distance in four ways. Brick courses, roof tiles and paving joints fade to an even tone once they are smaller than a pixel. Trees switch to their simpler model beyond the `near` distance. Walkers switch to their simpler figure beyond `peopleNear`. Small and medium street objects, the fine building parts, the ground cover and the walkers are not drawn beyond their own distances. The objects are re-sorted whenever the camera has moved five metres.

`quality` picks a step of the ladder in `CITY_QUALITY`, and `lod` overrides single values of that step.

| Quality | Meant for | Shadow map | Mirror scale | Trees full within | Plants within | Full figures within | People within |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `draft` | Slow machines and previews | 1024 | 0.35 | 40 m | not drawn | 14 m | 70 m |
| `live` | Interactive pages (the default) | 2048 | 0.5 | 75 m | 60 m | 32 m | 140 m |
| `high` | Strong machines and stills | 4096 | 0.75 | 130 m | 120 m | 70 m | 240 m |
| `film` | Frames rendered one at a time | 8192 | 1 | 320 m | 260 m | 260 m | 800 m |

```js
const street = cityScene(THREE, city, {quality: 'high', lod: {cover: 200, people: 400}});
```

### Traced light

Three kinds of light are traced rather than painted on. The model's street field holds `roof`, the height of the roofs over every cell of the grid, and the renderer marches rays through it. A ray is blocked wherever it passes below a roof.

Street lamps are real lights. Each lamp falls off with the square of its distance, lights only the faces turned toward it, throws most of its light below its own height, and is hidden by any building between it and the surface. A pixel looks at the lamps listed for its 16-metre cell, at most eight, and at none farther than 24 metres.

Sky light is scaled by how much of the sky a surface can see. Rays leave the surface in the half-space it faces, and the share that reach 34 metres without meeting a building scales the light from the sky, down to 22 percent where no sky is visible. Open squares stay bright, and the foot of a wall in a narrow street darkens.

Rooms behind windows are traced as well. A ray from the eye goes through the pane into a box as wide as the bay and as tall as the floor, and meets a wall, the floor or the ceiling. A lamp inside lights whichever surface the ray lands on. The view into a window therefore shifts as the camera moves. Shops and offices run on behind several bays, and shops also show goods on stands just behind the glass.

Two quality values set the cost. `skyRays` is the number of rays traced toward the sky per pixel, from 0 to 6, and `traceSteps` is the number of steps along each traced ray, from 0 to 32. With `traceSteps` at 0, lamps cast no shadows. With `skyRays` at 0, every surface receives the whole sky.

| Quality | `skyRays` | `traceSteps` |
| --- | --- | --- |
| `draft` | 0 | 0 |
| `live` | 2 | 8 |
| `high` | 4 | 14 |
| `film` | 1 per averaged render | 24 |

At film quality each of the averaged renders traces one sky ray in a new direction, and `filmSample` advances that direction, so the average converges on smooth light with no grain. At the other steps the directions are fixed per pixel, which can show as a fine static grain in deep shade.

### The diorama look

`dioramaLens` returns a lens for `cinematicPost` that keeps one band of the frame sharp and blurs the picture above and below it. A real street then reads as a table-top model, which is the effect of a tilt-shift lens.

```js
import {dioramaLens} from 'explainerkit/renderers/three/city';

const post = cinematicPost(THREE, renderer, {lens: dioramaLens({amount: 0.7, center: 0.55, width: 0.28}), grade});
```

`amount` runs from 0, which gives no blur, to 1. `center` places the sharp band, from 0 at the top of the frame to 1 at the bottom, and `width` is its height as a share of the frame, from 0.02 to 1. `angle` tilts the band, from -90 to 90 degrees, and `bloom` sets the glow round bright things, from 0 to 1. The look suits views from above. At film quality use `thinLens` instead, which blurs by real distance from the focus point.

```demo design-city-diorama
Apply the diorama lens to Île de la Cité in Paris. Compare it with the fully sharp view and look at the roofs and riverbanks near the top and bottom of the frame. The lens softens those areas while keeping a band through the center in focus.
```

### Film frames

At film quality a frame is the average of many renders, which `cinematicPost` does in its `film` mode. Its `render` call accepts `onSample(index, count)`, which runs before each of those renders. Two helpers use it to turn the average into the marks of a real camera.

`street.filmSample(index, count, {sunSize, shutter})` shows each sample the sun from a different point on its disc and the scene at a different instant inside the shutter time. The average then has shadows that soften with distance from what casts them, and motion blur on rain, snow and walkers. `sunSize` is the angular radius of the light in degrees, from 0 to 10 with a default of 1.1, and `shutter` is the exposure in seconds, from 0 to 1 with a default of 1/48.

`thinLens(camera, {position, target, focus, aperture}, index, count)` moves the camera to a point on a lens disc of radius `aperture` metres and aims it so that the point `focus` metres along the view stays put. Things at the focus distance stay sharp and everything nearer or farther blurs. Pass an index of -1 afterwards to put the camera back.

```js
const view = {position: [x, 2.4, z], target: [tx, 3.2, tz], focus: 26, aperture: 0.03};
post.render(scene, camera, {
  frame,
  onSample(i, n) {
    street.filmSample(i, n, {sunSize: 1.2, shutter: 1 / 50});
    thinLens(camera, view, i, n);
  },
});
thinLens(camera, view, -1, 1);
```

Film frames are not meant to run in real time. Each sample renders the shadow map, both mirrors and the scene again, so a 1080p frame of 32 samples takes seconds. Record them frame by frame with the `explainerkit-export-film` command, which the [film export guide](export-film.md) explains. The page provides a `window.explainerkitExport` hook whose `seek(time)` renders the frame for that time, film samples included, before it returns.

### Follow a vehicle

A chase shot reads the vehicle's pose every frame and places the camera behind it. `vehiclePose(city, index, time)` returns the vehicle's position `x`, `y` and `z` in model metres, its `speed` in metres per second and whether it is `visible`, which is false while it waits beyond the edge of the model to come back in. Its heading `turn` is an angle in radians measured from east toward north on the map, so in the model the vehicle faces `cos(turn)` along x and `-sin(turn)` along z.

```js
const pose = vehiclePose(city, 4, time);
const ahead = [Math.cos(pose.turn), -Math.sin(pose.turn)];
camera.position.set(pose.x - ahead[0] * 7, pose.y + 1.9, pose.z - ahead[1] * 7);
camera.lookAt(pose.x, pose.y + 0.8, pose.z);
```

The camera sits seven metres behind the vehicle and 1.9 metres above the road, and looks at a point 0.8 metres above the road at the vehicle's centre. Because the pose is a function of time, the same frame always shows the vehicle in the same place, so the shot can be scrubbed and exported like any other.

## Compare three places

Choose a neighborhood and switch between daylight, golden hour and night. Paris and London show bridges crossing a river. New York shows how Broadway cuts diagonally through the grid near Madison Square Park. Changing the time of day keeps the camera in place so you can compare shadows and see where lamps come on.

```demo design-city-maps
Paris, London and New York use saved OpenStreetMap extracts. This preview builds on a flat ground plane so you can compare the street layouts and lighting.
```

## Limits

The ground is flat when the caller supplies no terrain. Building height comes from the map or a default for the building type. The renderer approximates roofs using flat, gabled, hipped, pyramidal and skillion shapes. It draws windows, doors and shop fronts from each wall's layout, which limits their depth at close range.

Road and water reflections use a flat mirror plane. Other glass reflects the sky. The lamp shadow calculation treats buildings as blocks as tall as their highest point. Trees, vehicles and people cast shadows from the sun. The renderer calculates direct lighting, so a sunlit wall does not brighten the street opposite. Walkers keep to their routes without accounting for other walkers or traffic signals. Figures are low-detail. Faces and hands are simple shapes meant to read at street distance, arms swing only forward and back, and cloth hangs and sways with the stride but does not move in the wind. A walker that pauses stands still without an idle pose. Traffic does not yield to walkers, and trams and road vehicles do not see each other where a track runs along a road. On two-way streets narrower than about five metres, oncoming cars pass closer than their widths allow. The renderer has been checked in desktop Chromium.
