# Characters

Use `explainerkit/characters` to add a rigged character, give it actions and expressions, and connect it to live inputs. The module includes starter artwork, face and speech controls, planted-foot walks, pose tools, an audit and an SVG format artists can edit. Follow [Building a character that holds together](character-construction.md) to create a definition.

## Put a character in a scene

```demo design-bean-there
The bean scientist has bean thinking. Drag the clock through the wave, expression and silent speech shapes. Scrub back to return to any earlier pose.
```

```js
import { scene } from 'explainerkit';
import { character, starter } from 'explainerkit/characters';

const drawing = scene({ width: 960, height: 540 });
const ada = character(drawing, starter('bean-scientist'), { x: 160, y: 460, seed: 4 });

ada.act('walk', { at: .5, duration: 3 })          // eases in, plants feet, eases out
   .act('wave', { at: 4 })
   .say('Every invention starts as one point.', { at: 5.5 })
   .emote('happy', { at: 5.5, duration: 3 })
   .look({ at: 9, x: 1, y: -.4, until: 10.5 })
   .act('think', { at: 9 });
```

`character(scene, definition, {x, y, size, height, standOn, facing, seed, palette, idle})` adds the character as one scene component. `x, y` is the ground point between the feet (the body center for fish and microbes). `height` (scene units, or `'1.7m'` with `unit`) replaces `size`, and `standOn: surface({…})` keeps the feet on a floor or slope instead of a fixed `y`; see [staging](character-staging.md). `seed` varies blinks and eye darts between characters. `idle: false` turns off breathing, blinking and eye darts.

Every method adds a timed clip and returns the character, so calls chain. Clips fade in and out (`fadeIn`, `fadeOut`, default about 0.25 s) and layer over the idle behavior. **Every frame is computed from time**, so seeking and scrubbing backward are exact.

| Method | What it does |
| --- | --- |
| `act(name, {at, duration, ...params})` | Runs a rig action (lists below). Traveling actions (`walk`, `run`, `swim`) take `speed` (character units per second), `direction` (1 or −1, also turns the character) and `ramp` (ease time). |
| `say(text, {at, rate})` | Mouth shapes timed from the text at `rate` characters per second, with small nods on word starts. |
| `emote(mood, {at, duration})` | Choose `happy`, `sad`, `surprised`, `angry`, `thinking`, `sleepy` or `neutral` to control brows, lids, mouth and eye size. |
| `look({at, x, y, until})` | Gaze toward a direction in [−1, 1]. Eyes lead quickly; the head follows with critically damped lag. |
| `socket(name, time)` | World position and rotation of a declared hand, foot or head socket. [Props and orientation](character-props-turns.md). |
| `hold(handle, options)` | Sampled hand attachment, anchor/offset, entry/release blends and frozen world release. Same guide. |
| `track(x, y, {halfLife, reach})` | Eyes and head follow a live scene point (two scene parameters), smoothed by the seekable `lag` from `explainerkit/physics`. |
| `drive(inputs, map, {mode})` | Add or set pose channels from live scene inputs every frame, e.g. a smile driven by pointer distance. |
| `walkTo(x, {at, speed})` | Queue a walk (or swim) to scene x after any current move; returns the arrival time. |
| `scaleTo(k, {at, duration, ease, anchor})` | Ease to k × the authored size, holding the feet (body centre for fish and microbes) still; seekable. |
| `standOn(surface)` | Stand on a `surface()` from now on; feet meet the ground under each foot. |
| `inspect(time)` | Inspect pose values, the root transform and every part’s geometry in the solved frame. The audit uses this result. |

## Ground, size and crowds

[Character staging](character-staging.md) covers `surface()`, `standOn`, `scaleTo`, real-world `height` with every rig's measured `restHeight`, and `crowd()` for rows of people that stand on the ground, interleave heads and paint back to front.

## The starter cast

`STARTERS` lists 16 characters, and `starter(id, overrides)` creates the selected definition. Their artwork consists of original drawings released under CC0.

| Rig | Builder | Starters | Actions |
| --- | --- | --- | --- |
| Rubber-hose biped, 2.5 heads tall | `bean({palette, skin, hair, hairStyle, accessory})` | `bean-everyday`, `bean-scientist`, `bean-engineer`, `bean-student`, `bean-night` | walk, run, hop, wave, point, think, cheer, shrug, present, hold, nod, shake |
| Two-bone IK stick figure, about 5 heads tall | `stick({style, ink, paper, skin, shirt, pants, face})` | `stick-classic`, `stick-xkcd`, `stick-bold`, `stick-pill` | Same biped library |
| Songbird | `bird({palette})` | `bird-robin`, `bird-canary`, `bird-bluebird` | walk (hops), hop, flap, fly, peck, sing |
| Spine-wave fish | `fish({palette})` | `fish-clown`, `fish-teal` | swim, dart, gulp |
| Blob microbe | `microbe({palette})` | `microbe-mint`, `microbe-violet` | swim, pulse, squish |

Choose a bean `palette` from `teal`, `coral`, `mustard`, `lab` and `night`. Skin choices are `light`, `tan`, `brown` and `deep`, and hair colors are `dark`, `brown`, `blond`, `red` and `gray`. Use `hairStyle` to select `short`, `bun`, `curly` or `none`, and `accessory` to select `none`, `glasses` or `hardhat`. Stick figures accept `style` values of `classic`, `xkcd`, `bold` and `pill`.

## How the rigs work

- **Cut-out construction.** Bone angles determine the positions of rigid parts through forward kinematics. Drawing order is independent, so a back arm can be behind the body while a front arm is in front. Bean limbs use curved hoses whose bend sits where two equal half-length segments meet. Stick limbs use inverse kinematics to keep upper and lower bone lengths fixed, with elbows bending back and knees forward.
- **Shared biped library.** `bipedActions(layout)` drives hand, foot, body and head properties. Its footstep planner starts with a half step, uses full steps, then closes into a standing pose. Feet remain fixed in world space between swings, with both feet supporting the body for about 20% of the cycle. The pelvis lowers when needed to keep a foot within reach. The audit checks that planted feet do not slide, including during acceleration and deceleration, for every starter.
- **Face rig.** Eyes have pupils, catch-lights and lids clipped to the eye shape. Brows, cheeks and a configurable mouth supply expressions. A seeded blink schedule averages about 15 blinks per minute, while eye darts hold for 0.4–2.4 seconds.
- **Speech.** Nine mouth shapes based on the Rhubarb Lip Sync and Preston Blair set use names A–H and X. Letters select the shapes with 40 ms crossfades. This times text rather than recognizing phonemes from audio.
- **Shading.** Default construction gives each part a shade tone, a copy offset toward a fixed screen light, and a highlight. The screen light stays consistent while parts rotate or characters turn. Set `shade:true` for scene lighting and see [production controls](character-production.md).
- **Custom rigs.** A definition contains `{name,bones,parts,rest,palette,idle,post,actions,actionDefaults,sockets}` as plain data and functions without hidden state. See `src/characters/rigs/` for complete examples.

## Edit characters as SVG

```js
import { exportCharacterSVG, characterFromSVG, starter } from 'explainerkit/characters';
const svg = exportCharacterSVG(starter('bean-everyday'));      // hand this to an illustrator
const edited = characterFromSVG(starter('bean-everyday'), editedSvgText);
character(drawing, edited, { x: 300, y: 460 });
```

The exported SVG shows the character’s rest pose as flat, editable layers. Edit artwork, pivots or palette swatches in the layer that owns them and leave registration marks unchanged.

| Layer | Contents | Edit to… |
| --- | --- | --- |
| `parts` | One group per part (`<g id="body">`) holding `<path id="body-art">` | Reshape static art. Paths you add inside a part's group become decoration on that bone. |
| `pivots` | `pivot-<bone>` circles | Move joints. |
| `palette` | `slot-<name>-base`, `-shade`, `-light` swatches | Recolor the whole character. |
| `registration` | `mark-origin` and `mark-unit` | Leave alone; they recover placement and scale after any editor reflows the file. |

Parts marked `data-procedural`, including faces, limbs and fish bodies, have shapes generated by code on each frame. Editing their colors affects playback, but editing a generated outline does not replace that procedure. Exported clips are converted to the visible shape. Tests for every starter check round trips within the export’s 0.01-unit rounding.

## The starter pack

The starter characters are also published as a pack of files that an illustrator can edit. ExplainerKit's development repository builds that pack, which is not yet included in the npm package. Each character folder in it contains `character.svg`, `character.json` and a CC0 `LICENSE.txt`. The JSON format is `explainerkit-character@1` and records the builder, options, rig, actions and license. The build also writes `index.json` and `explainerkit-characters-starter.zip`. Load a folder with `loadCharacterPack(manifest, svgText?)`. Packs contain data and artwork while the module supplies their animation code.

## Limits

- Characters face left or right. [Edge turnarounds](character-props-turns.md#authored-edge-turnarounds) narrow the cutout silhouette and swap projected sides; three-quarter/front anatomical rotation still requires authored art or another representation.
- Text timing is the default; externally prepared Rhubarb audio cues can be imported with `lipSync` ([production controls](character-production.md)).
- For four-legged animals, use `quadruped`; see [rig families](character-families.md) for its parameters and limits.
- Walks follow a `surface()` (flat or polyline); feet do not choose footholds, and stairs are steep short risers ([staging limits](character-staging.md#limits)).
- Gaze uses shared `lag`; buns and bird tails have bounded `jiggle` follow-through. Other appendages remain work ([production controls](character-production.md)).
- The audit checks geometry and timing, not appeal; look at characters large as well.
- Default shading retains the fixed-light construction. Explicit `shade:true` uses scene `light()` and native `shade`; the default switch remains gated on performance and visual approval.
