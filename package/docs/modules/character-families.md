# Parametric rig families

Choose `quadruped` for a four-legged body, `winged` for an insect-like or winged body, and `jumper` for a body with hind legs suited to leaps. Each creates a definition for the shared `character` runtime, so proportions and appearance can change without selecting another action engine. `cow`, `mouse`, `dragonfly` and `frog` are ready-made settings for these builders. Their settings are stored in `definition.meta.parameters` and included in `FAMILY_PRESETS`, `BUILDERS`, `STARTERS`, `starter`, `manifestFor` and `loadCharacterPack`.

```js
import {character, quadruped, dragonfly, frog} from 'explainerkit/characters';
const animal = character(scene, quadruped({
  body: {width: 100, height: 35, color: '#9b8c72', pattern: 'plain'},
  neck: {length: 20, rise: 10},
  legs: {length: 45, joints: 3, width: 5},
  tail: {length: 35}, head: {width: 30, height: 24},
  ears: {length: 14, width: 7},
}));
animal.act('walk', {at: 0, duration: 3});
const insect = character(scene, dragonfly({wings: {frequency: 5}}));
insect.act('flap', {at: 0, duration: 5, fadeIn: 0, fadeOut: 0});
const hopper = character(scene, frog(), {x: 120, y: 400});
const landedAt = hopper.walkTo(440, {at: 0, action: 'leap', speed: 100});
```

All lengths are character-local units, angles are radians and times are seconds.
Changing `character({size})` scales the whole definition. Every option is finite
and validated; unknown fields, getters, illegal topology and non-colors refuse.
Preset overrides merge nested part settings, preserving unspecified preset
fields. No topology or anatomy is inferred from a name or imported picture.

```demo design-family-pond
Pull the lily-pad marker to sample a dragonfly flapping and a frog leaping. Their bodies and actions differ, and both use the same character runtime. Take a leap of frog.
```

## Parameters and actions

Every body accepts `width` (or its alias `length`, never both) 20–160, `height`
12–60, a solid `color`, and `pattern:'plain'|'spots'|'stripe'`. Defaults differ by
family. `name` follows the existing character-definition naming contract.

| Family | Additional parameters | Existing named actions |
| --- | --- | --- |
| `quadruped` | `legs.length` 12–100, `joints:2|3`, `width` 1–min(12,length/2); `neck.length` 4–60, `rise` 0–40, `width` 2–24; `head.width` 12–60, `height` 12–48; `tail.length` 0–100, `width` 1–10; `ears.length` 0–30, `width` 2–20 | `walk`, `trot`, `graze`, `look`, `sit` |
| `winged` | `wings.pairs:1|2`, `shape:'ellipse'|'leaf'|'feather'`, `frequency` 0.5–8 Hz, `span` 12–100, `chord` 0.12–0.3; `legs` may be 0/2/4/6 or `{count,length:0–40,width:1–5}` | `hover`, `glide`, `flap`, `bob` |
| `jumper` | `legs.hind` 20–100, `fore` 12–80, `width` 1–10 | `sit`, `crouch`, `leap`, `spread` |

Four-leg gaits keep their stance feet planted against the existing integrated
root travel. Walking uses four ordered phases; trotting pairs the diagonals.
Two/three-link legs solve exact reach with a fixed bend convention, and closure
steps return all feet to their rest offsets. A move supports at most 4096 gait
strides; split longer clips. `lift` may be 0–30% of leg length. Ordinary move
options (`speed`, `direction`, `ramp`, `at`, `duration`) remain those of the shared
runtime. There is no collision, terrain inference or joint dynamics solver.

Wing motion changes the projected wing thickness around its attachment. The
normalized cycle phase is quantized to 1e-8 cycles, allowing canonical periodic
samples to compare exactly. Use `fadeIn:0,fadeOut:0` to inspect pure flap cycles;
a fading clip intentionally has different weights across cycles. Pointed feather
tips declare `sharp:true` to the existing sliver audit. This is stylized 2D wing
projection, not flight aerodynamics or 3D feather articulation.

A leap follows a parabolic vertical arc. `walkTo(targetX,{action:'leap'})` calculates root travel to land at the requested x on the **same ground level**, including short distances and either direction. Speed accepts 1–10000 character units per second and the move must fit the 86400-second timeline.

The leap must control root travel and keep scale constant during flight. Existing root following or overlapping scale clips are rejected, and new root-follow or scale drivers must not be installed over the flight afterward. `leap.height` accepts 40–300% of hind-leg length and defaults to 80%. The spread pose occurs in the air. Actions return to rest at their boundaries while completed root travel remains. Author a ground or path explicitly for a target at another height.

## Shared keys, following and audit

All pose channels are ordinary numeric rest channels, so `keys` works for head,
body, individual foot coordinates and wing scale. Use `follow(track,{feet:'none'})`
for an externally authored x path. Automatic `feet:'auto'` remains the documented
biped-only solver; it is not silently applied to a quadruped or insect. Following
owns root x, so do not combine it with targeted `walkTo` travel.

`auditCharacter` checks connected parts, joints, limb lengths, floor clearance and contact, sliding, abrupt movement, bend flips, spikes, folds and rewind. Its airborne-contact threshold scales with the configured geometric tolerance rather than using an absolute half-unit, so small rigs are assessed consistently. Run gait audits at the default 30 Hz or faster because a lower rate can miss a whole foot swing and mistake the next stance for continuous sliding.

`tests/modules/character-families.test.js` runs every action on seeded varied
proportions, presets and documented extremes; it also checks exact flap cycles,
target landing, keys/follow, input refusal and rewind. The renderer fixture
`tests/browser/character-families-checks.html` exercises the four presets through
SVG and Canvas. These are original synthetic acceptance fixtures. The local
reference reel and subjective animal likeness remain separate visual-review work.
