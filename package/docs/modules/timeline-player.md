# Play and synchronize a timeline

A timeline describes how named values change, while a timeline player supplies the clock that advances those values in the browser. Use `createTimelinePlayer` from `explainerkit/player` when your application already owns the objects being drawn and needs ExplainerKit to coordinate their motion. Your application receives the sampled values and applies them to its chosen renderer.

The example assumes `machine` is an object with position and rotation properties, and `announce` is a function supplied by your application. The timeline does not create either of them. Three.js can supply such an object, but it is optional and is not imported by the timing model or player.

```js
import {createTimeline, easingCurve} from 'explainerkit/motion';
import {createTimelinePlayer} from 'explainerkit/player';

const motion = createTimeline({repeat: 1, alternate: true})
  .label('open', .25)
  .add({
    'machine.x': {from: 0, to: 100, duration: 1},
    'machine.angle': {
      from: 0, to: Math.PI / 2, duration: 1,
      ease: easingCurve({family: 'expo', mode: 'inOut'}),
    },
  }, 'open')
  .event({name: 'opened'}, 1.25);

const player = createTimelinePlayer(motion, {
  project({values}) {
    // Your stage owns its objects; ExplainerKit owns timing and sampling.
    machine.position.x = values['machine.x'];
    machine.rotation.z = values['machine.angle'];
  },
  onEvent(event) { announce(event.name); },
});
player.play();
player.pause();
player.seek(.75);
player.restart();
// Call player.dispose() when done. Dispose your renderer separately.
```

The `project` callback receives the current values and writes them to `machine`. The `onEvent` callback receives the planned `opened` event when playback or a seek crosses it. All times use seconds. Read the [timeline guide](timelines.md) for labels, relative positions, keyframes and repetition, or use a scene player when the output should be native scene handles and camera-projected frames.

```demo design-encore-events
The curtain call works in reverse. Drag the clock across the star, then go back. The timeline player delivers the event in either direction and updates the curtain from the sampled values.
```

## Clock and event ownership

Creating a player draws its time-zero values and leaves it paused without dispatching events. Its play, pause, seek, restart and speed controls use the same clock implementation as scene players. Multiple timeline and projection players on one browser host share a pending animation-frame request, while keeping independent pause, seek and cleanup state. Newly requested callbacks run on the following frame rather than joining a frame already being processed.

A seek normally delivers events crossed between the previous and requested time, including reverse seeks. Pass `mute:true` to update the drawing without those event effects. Events at time zero are eligible once when playback first starts or an unmuted seek begins, and `restart()` makes that initial boundary eligible again. Call `refresh()` to redraw the current plan with event effects muted.

Before drawing, the player obtains the ordered event list and checks its work limits. A seek that crosses too many events therefore fails before your event callbacks execute. The callbacks receive a context containing `time`, `previousTime`, `backwards` and the operation `kind`, which lets your application distinguish ordinary playback from other updates.

The player commits its own time and frame only after drawing and event delivery succeed. It cannot undo arbitrary work your callbacks perform elsewhere, such as changing another application's state. Make renderer writes all-or-nothing when that behavior is required, and provide your own recovery for external event effects. A failure during a clock tick pauses playback and emits an error.

A **driver** is the input currently allowed to control player time. For example, `setDriver('scroll')` reserves that control for a scroll adapter, which calls `seek(time,{source:'scroll'})`. Ordinary play and manual seek requests are rejected while the scroll driver owns time. A media driver uses `setDriver('media')` and `syncTime(time,{playing,source:'media'})`. Release a driver with `setDriver(null)` before handing control to another one.

The `attachScroll` adapter can drive this player directly. Its `reset:true` seek option is accepted, but a pure timeline has no interactive parameter overrides to reset. That flag therefore leaves the timeline's values and event rules unchanged.

## Duration, policy and disposal

The player's duration is limited by `horizon`, which defaults to 86,400 seconds and cannot exceed that value. This also gives an infinitely repeating timeline a finite playback range. `progress` describes position within that full playback duration, while `iterationTime` and `iteration` describe the current repeated cycle. Event delivery defaults to at most 1,024 crossings per update, and `maxEvents` can be set between one and 10,000. The model separately limits the work needed to find those events.

The optional `host` supplies browser scheduling and media-query behavior. By default, reduced-motion preferences block playback while leaving manual seeking available. Supply a boolean `reducedMotion` when your application needs to choose that policy explicitly.

Call `dispose()` when the player is no longer needed. Cleanup cancels its scheduled work, removes listeners and releases references to its model and drawing callback. It does not dispose your renderer or other players using the shared frame host. A disposed player cannot be reused, and importing a module never starts playback by itself.

## Prepared projection

For a large timeline, `projectValues` can avoid building a named value record for each frame. It receives a read-only packet whose `channels` array names the values stored at matching positions in `values`. Find each required name's array position when the channel layout changes, then use that position while drawing.

The player prepares this layout once and prepares it again after the timeline is edited. The following example caches the array position for `x` and writes its current value to the application-owned `machine`.

```js
const motion = createTimeline().add({x: {from: 0, to: 100, duration: 1}});
let layout, xSlot;
const player = createTimelinePlayer(motion, {
  projectValues(packet) {
    if (layout !== packet.channels) {
      layout = packet.channels;
      xSlot = layout.indexOf('x');
    }
    machine.position.x = packet.values[xSlot];
  },
});
player.seek(.5);
player.dispose();
```

Supply exactly one of `project` or `projectValues`. Both complete value evaluation and event-limit checks before drawing. Your renderer writes and event effects remain application code, with the same recovery responsibilities in either mode.

The `player.frame` property and `frame` event still provide named, read-only snapshots. In `projectValues` mode, requesting such a snapshot builds it from the packet that was already evaluated rather than calling easing or modifier functions again. A retained event keeps its own packet even if another listener seeks during event delivery.

The event's `frame` property is an enumerable getter, so inspecting or spreading the event can create that named record. `refresh()` also returns a named frame. If you chose indexed values to avoid building those records on every frame, avoid inspecting them unnecessarily. Clock scheduling, drivers, seeking and cleanup work the same way with either drawing callback.
