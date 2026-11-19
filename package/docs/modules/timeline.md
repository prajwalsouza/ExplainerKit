# Edit animation keys and curves

Use the timeline editor when people need to adjust the timing and values of an animation that already exists in a scene. A key records a property's value at a particular time, and the segment between two keys describes how the value changes. The editor shows those keys and curves while the scene's player continues to own playback.

Start with a scene containing the object you want to edit. The example assumes `drawing` is that scene, `dot` is a drawable handle, and `stage` and `panel` are existing page elements. Your application supplies `saveDraft` if edits should also be saved. The initial call to `dot.keys()` creates the animation before the editor opens.

```js
import { createTimeline } from 'explainerkit/editor/timeline';
const keys = [
  { at: 0, value: 40, ease: 'linear' },
  { at: 1, value: 320, ease: 'smooth' },
  { at: 2, value: 180 },
];
dot.keys('x', keys);
const player = await drawing.mount(stage);
const editor = createTimeline(player, panel, {
  tracks: [{ label: 'Marker position', handle: dot, property: 'x', keys }],
  onChange: ({ track, key, keys }) => saveDraft(keys),
  onError: error => console.error(error.code, error.message),
});
```

The `tracks` option tells the editor which properties to show. Each track identifies a handle, a numeric property and the same keys used to create its animation. Opening the editor inspects that supplied list without creating another animation or discovering unrelated scene properties. It adds one styled region to `panel` and preserves any children already there.

```demo design-rabbit-late
Move a diamond. Make a rabbit late. Select the middle key, edit its Time, then move the editor’s time slider to see when the rabbit reaches that position.
```

## Move through the animation

Play, Pause and the native time slider control the existing player. When scrolling controls the player's clock, the editor disables manual playback controls so two inputs cannot compete for time. A media-controlled player instead receives the editor's normal transport requests. Reduced-motion preferences also remain the player's responsibility.

Seeking from the editor uses `reset:false`. This lets a reader inspect another frame without clearing unrelated values they have changed through interactive controls. Opening an editor does not install another frame scheduler or evaluate generated source code.

## Change a key

Click or tap a diamond to select its key, then change its Time or Value field. The editor applies the new value when the field emits its native `change` event. With a key button focused, Left and Right move its time by `.01` seconds, or `.1` seconds while Shift is held. These increments are editing defaults rather than claims about perceptually ideal animation timing.

After an edit, focus returns to the same key. Native number fields provide another way to edit with a single pointer, so custom dragging and long-press gestures are not required. An edit that crosses the first or last allowed time, or collides with an adjacent key, is rejected while the previous animation and frame remain unchanged.

## Shape the transition between keys

Expand **Segment easing** to inspect how the selected key moves toward the next one. The displayed SVG curve is controlled by four cubic Bézier values, which describe the two control points that bend the transition. Changing these controls stores an `[x1,y1,x2,y2]` tuple and applies it through `cubicBezier`.

The x values must stay between zero and one, while the y values may extend outside that range to produce overshoot. The editor can represent `linear`, `smooth` and `easeOut` with equivalent cubic handles. Other named curves and trusted functions show a sampled preview. Editing their displayed default controls replaces that custom easing with the new cubic curve, so the preview explains what will change before it is committed.

The final key has no following segment, so its curve controls are disabled. Typed curves are previewed before committing. Cubic y extrema, the highest and lowest points of the curve, are checked against the property's supported range. A curve that would push opacity, radius or another bounded value outside that range is rejected before changing the track.

Trusted custom easing functions receive a 65-sample preliminary check and the usual runtime validation. Sampling a function at those points cannot prove that every possible result stays within range, so the runtime checks still matter when the animation runs.

## Save edits and handle failures

A successful edit replaces all keys for that property through `replaceKeys(property, keys)`, updates the editor's read-only model and calls `onChange({track,key,keys})`. The callback tells your application what changed, but it does not save anything by itself. Named easings and cubic tuples can be serialized, while arbitrary easing functions remain JavaScript function references.

When a UI edit fails, the fields return to their committed values and a live status region announces the runtime's repair message. A failure inside your callback reports `CALLBACK_FAILED` without undoing the animation edit that already succeeded. Keep those two operations separate when deciding how your application should recover from a failed save.

The returned controller exposes the following members.

| Member | What it provides |
| --- | --- |
| `element` | This is the region mounted in your container. |
| `tracks` | These are read-only records containing each track's label, handle, property and keys. Source arrays and cubic tuples are copied. |
| `selection` | This is the selected `{track,key}` pair, or `null` when the editor has no keys. |
| `select(track,key)` | This selects and focuses a key, then returns the editor. |
| `update(track,key,{at?,value?,ease?})` | This applies a validated edit in one operation. Invalid edits throw before changing the track or model. |
| `dispose()` / `disposed` | Cleanup removes this editor's DOM, listeners, subscriptions and ownership while retaining successful animation edits. Repeated cleanup is safe, and disposing the player also disposes its editor. |

## Keep editing ownership clear

An editor supports up to 32 tracks with 128 strictly ordered keys per track. Only one editor can own a particular object/property pair, and only one can occupy a mounting container. A conflicting editor throws `TIMELINE_OWNED`, while independent properties and containers can use separate editors with the same player.

Use the owning editor to change a track while it is open. Raw external calls to `replaceKeys` are not observed or merged, so they can leave the editor's view out of step with the animation. Disposing one editor releases its ownership without disturbing other editors.

This editor covers selecting keys, changing their time or value, and editing segment curves. It does not provide undo history, key insertion or deletion, automatic track discovery, dragged curve handles, dense-key collision management or a full frame-by-frame timing editor. Use the supported operations directly when building application controls around it.

The native tests in `tests/modules/timeline.test.js` check these editing rules. The browser fixture in `tests/browser/timeline-checks.html` checks playback, keyboard focus, rejected input, curve previews, rewind, ownership, cleanup and narrow layouts. Native controls and visible focus provide specific interaction affordances, but these checks do not establish physical touch-device usability or accessibility certification.
