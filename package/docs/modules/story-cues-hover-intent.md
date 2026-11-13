# Scroll cues and hover intent

Use a scroll cue when crossing a point in a story should change application UI, such as opening a panel. Use hover intent when a pointer should settle over an item before selecting it. Both adapters share the existing story, player or input-source lifecycle rather than changing scene sampling or starting devices. Your application supplies the cue's effects and the function that identifies an item under the pointer.

## Position crossings with explicit reverse policies

```js
import {attachStory} from 'explainerkit/story';

const story = attachStory(player, {
  element: region,
  acts: [{id: 'intro', length: '150vh'}, {id: 'detail', length: '200vh'}],
  cues: [{
    id: 'detail-ui', at: 'detail', reverse: 'undo',
    enter(ctx) { panel.hidden = false; panel.dataset.pace = ctx.pace; },
    leave() { panel.hidden = true; },
  }],
});
// Later: story.dispose().
```

Place a cue at an act's start with `at: 'detail'`, at story seconds with a number or `{time: 2}`, or at a scroll distance from the story start with `{position: 500}`. A time inside a hold resolves to the hold's start, where further scrolling leaves story time fixed. Locations are resolved again on resize or update. If remapping moves a cue across the current scroll position, the next position update can enter or leave it without a new gesture. Direction follows that crossing. Invalid act names or out-of-range locations are rejected before ownership or a valid map changes.

| `reverse` | On forward entry | On crossing backward | While remaining above the point |
| --- | --- | --- | --- |
| `undo` (default) | It calls `enter`. | It calls `leave` and rearms entry. | It calls nothing. |
| `keep` | It calls `enter` once per attachment. | It keeps the completed state. | It calls nothing. |
| `replay` | It calls `enter`. | It rearms without calling `leave`. | It calls nothing. |
| `scrub` | It calls `enter`. | It calls `leave` and rearms entry. | It calls `enter` for each changed position with `phase: 'scrub'`. |

In scrub mode, draw application state from the supplied position and time rather than starting a separate animation. A point cue has no duration or automatic local progress range. Put seekable motion on the scene itself when it spans an interval, or calculate the interval explicitly in your callback.

A handler receives the cue `id`, resolved pixel `at`, current `position`, scene `time`, story `progress`, current `act`, signed `direction`, `pace`, velocity in px/s, speed in viewport-heights/s, `phase` and an abort `signal`. The `rushing` flag is true for rushing pace or a reduced-motion preference. Handlers are trusted synchronous application code and own any external effects or asynchronous cancellation. Disposal aborts the signal but does not run arbitrary `leave` effects, so cleanup must not depend on a final leave callback.

Cue crossings use the actual scroll position, which can be negative above the
story or exceed its length below it. Scene time and whole-story progress remain
clamped. This lets a cue at zero unwind when the reader scrolls above the region.

Attaching after the browser restores scroll position runs already-crossed entries in ascending location order. Fast forward gestures use the same order, while backward gestures undo in descending order. Ties use authored order forward and reverse authored order backward. An unchanged position does not repeat callbacks, and keep mode retains its fired state until detachment. Each position update allows at most 256 cues and 256 callback calls. Disposing inside a handler stops remaining callbacks and scheduled player work. Calling `refresh` or `update` recursively from a cue throws `STORY_CUE_REENTRANCY`, so queue a later update instead.

## Settled pointer identity

Create and start a pointer source before using hover intent. The hit callback should return the stable ID of the item under the supplied coordinates, or null for empty space. Hover intent delays a new selection so a passing pointer does not immediately activate every item it crosses.

Create and start a pointer source before using hover intent. The hit callback should return the stable ID of the item under the supplied coordinates, or null for empty space. Hover intent delays a new selection so a passing pointer does not immediately activate every item it crosses.

```js
import {pointerInput, hoverIntent} from 'explainerkit/inputs';

const pointer = pointerInput(diagram);
const hover = hoverIntent(pointer, {
  hit: (x, y) => hitTestDiagram(x, y), // a string/number ID or null
  dwell: 0.05, fastDwell: 0.32, leave: 0.14,
  speedThreshold: 1000, // upstream coordinate units per second; px/s for pointerInput
});
await pointer.start();
await hover.start();
const unsubscribe = hover.subscribe(snapshot => {
  const observation = snapshot.latest;
  if (observation?.quality.valid) selectDiagramItem(observation.value);
});
// Later: unsubscribe(); hover.dispose(); pointer.dispose().
```

All delays use seconds and cannot exceed 60. A candidate must stay under the pointer for its dwell time before selection, with `fastDwell` at least as long as `dwell`. Rapid observations extend the fast deadline, while a later slow or stationary observation can shorten it to dwell. Moving into empty space retains the selected ID for `leave` seconds, and returning to that ID cancels departure. Touch and pressed-pointer observations count as empty space rather than simulated hover. Your application must handle keyboard and focus selection separately.

Hover intent returns an `InputSource< string | number | null >` with `start`, `stop`, `dispose`, `snapshot` and `subscribe`. It subscribes to an upstream source without starting that source and releases only its own subscription and timer. A fresh null means valid empty selection. Upstream stop, invalid observations or expiry instead produce an invalid null. New epochs reset selection and dwell state. An invalid hit ID changes the source to error and releases its resources. IDs are numbers within ±1e9 or strings up to 256 characters, with the shared observation byte and sample limits still applied.

Supply both `clock: () => seconds` and `environment: {setTimeout, clearTimeout}` when simulating time in tests. Velocity uses upstream observation timestamps, while dwell uses the derived source's own clock. The adapter does not subtract timestamps from different clocks. It owns at most one timer for the next dwell, departure or freshness expiry rather than polling with animation frames. A trusted hit callback runs at most once per upstream notification or timer callback, and your code must limit its own work.

Native tests cover all policies, both fling directions, initial restoration,
accessor rejection, invalid timeline updates, reentrant/disposal behavior, fake
clock dwell/sweeps/leaves/expiry, and source ownership. The browser fixture
`story-cues-inputs-checks.html` exercises real nested scrolling and pointer events.
