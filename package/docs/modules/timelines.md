# Schedule motion with a timeline

Use a timeline to describe how several named values change together. A **channel** is one of those named values, such as `dot.x`, and a timeline records the changes scheduled for each channel. It can return the values at any chosen time without owning a browser clock or changing your drawing objects directly.

Import `createTimeline` and `Timeline` from `explainerkit/motion`. Their times use seconds, and channels can contain numbers, supported colors or strings. The similarly named function in `explainerkit/editor/timeline` creates an editing interface instead. This page describes the motion model that the [timeline player](timeline-player.md) can run.

```js
import {createTimeline} from 'explainerkit/motion';

const motion = createTimeline({defaults: {duration: 1, ease: 'easeInOut'}})
  .set({'dot.opacity': 1}, 0)
  .label('move', .25)
  .add({'dot.x': {from: 0, to: 200}}, 'move')
  .add({'dot.y': {
    keyframes: [
      {from: 0, to: -40, duration: .3},
      {to: 0, duration: .5, delay: .1},
    ],
    repeat: 1,
    alternate: true,
  }}, '<<')
  .event({name: 'arrived', data: {id: 'dot'}}, 1.25);

const snapshot = motion.sample(.75);
// snapshot.values['dot.x']; snapshot.localTime; snapshot.iteration; snapshot.direction
```

Here, the `move` label places the horizontal movement at a quarter of a second. The `dot.y` sequence starts alongside it because `<<` refers to the preceding group's start. Calling `sample(.75)` calculates the values at that moment and returns a read-only snapshot, including its `values`, cycle position and direction.

You can sample a later time and return to an earlier one without replaying the intervening frames. Values are calculated from the timeline's authored state, meaning the instructions you supplied when building it. Changes to external parameters are not cached. A scene can use `scene.derive([ambient, progress], ...)` to sample a timeline and bind its values to shape properties, while a timeline player can advance time for browser playback.

## Positions and channel ownership

Most authoring methods accept a position that says when their work begins. This can be an absolute time in seconds or a previously declared label. The marker `<` means the previous group's end, while `<<` means its start. Add `+=.25` or `-=.25` to a label or marker to move a quarter-second from that position. Used alone, `+=.25` refers to the current authored end. Omitting the position appends at that end.

Use `label(name, position)` to name a position and `resolvePosition(position, fallback?)` to calculate one without changing the plan. The `labels` property returns a read-only copy. Methods such as `add`, `set`, `child`, `event` and `wait` return the timeline, so you can chain related instructions as in the example.

The first segment for a channel needs a `from` value. Later segments can infer their starting value from that channel's sampled value at insertion time. Supplying an explicit start is useful when inserting earlier work because it makes your intended starting state clear. A group that starts later takes control of its channels from that point onward and keeps its ending value until another group replaces it. Groups with equal start times use authoring order, and a future modifier does not change values before its own start.

A channel can set `from`, `to`, `duration`, `delay`, `ease`, `repeat`, `repeatDelay`, `alternate`, `reversed`, `modifier`, `interpolate` and `type`, or supply a `keyframes` array. Each keyframe describes another step with `to` and optional `from`, `duration`, `delay`, `ease` and `modifier`. Its optional `at` value places that step within the group. Keyframes cannot overlap. Tiny arithmetic differences within `1e-12 * max(1, offset, previousEnd)` are moved forward to the previous end, while meaningful overlaps are rejected.

Easing describes how progress changes during a segment. Named curves come from the library, while trusted easing functions can produce overshoot beyond the usual zero-to-one progress range. Numbers and strings with matching numeric fields retain that overshoot. Colors instead keep the interpolation fraction within their supported range and blend sRGB channels after weighting them by opacity.

A string pair such as `'0px 0%'` and `'20px 100%'` has two matching numeric fields that can change together. Other strings switch at the endpoint. Set `type:'string'` to require a matching template, `type:'color'` to require supported solid colors, or `type:'discrete'` for endpoint switching. These values are not executed as code or passed to a browser parser. Custom `interpolate(from, to, easedProgress)` and `modifier(value)` functions run as trusted application code, and every sampled result must still be a bounded finite number or string.

## Repetition and nesting

`repeat` counts additional iterations, so zero plays once and two plays three times. It accepts whole numbers from zero to 10,000 or `Infinity`. `alternate` reverses successive cycles, while `reversed` reverses the first one. A repeat delay holds the endpoint between cycles. These settings can apply to the whole timeline or to one channel's keyframe sequence, but a zero-duration channel cycle cannot repeat.

The `duration` property includes all repeats and can be infinite. `iterationDuration` describes one model-level cycle and can also be infinite. The separate `authoredDuration` is the finite span used when adding work at the end or stretching the plan. Finite children and repeated channels contribute their full ending time, while an infinite channel or child contributes its finite nominal cycle. Infinite cycles continue after that authoring end.

An empty timeline has zero duration even if repetition is configured, which lets you construct it incrementally. A timeline with an infinite authored span cannot be reversed as a whole, so reverse its finite channel cycles instead when that is the intended motion.

`child(otherTimeline, position)` captures the child timeline as it exists at that moment. Later edits to the child do not change the parent. Insert a new capture to use those edits. Once a child starts, it controls its named channels until a later parent group takes control. To inspect a single channel, call `valueAt(channel, time)`. This avoids evaluating unrelated channels and returns `undefined` when the name is unknown.

Use `scaleTime(factor)` to multiply positions, delays, keyframe times, child clocks, labels and events by one factor. Use `stretch(seconds)` to give the plan a new finite `authoredDuration`. Both validate the change before committing it. Successful authoring edits increment `version` so a player can detect a new plan, while sampling does not change that version.

## Events are plans, not callbacks

An event marks a point that application code may need to react to, but the model only records that intention. Calling `eventsBetween(from, to, {maxEvents:1024})` returns a read-only list with names, optional data, absolute times, iterations and directions. It excludes the starting boundary and includes the destination boundary in either direction.

Events at the same time keep authoring order when moving forward and reverse that order when moving backward. Starting a query at `-1e-9` includes an initial event at time zero. A player obtains and validates the complete event list before invoking callbacks, so a query that exceeds the work limit is rejected before any of those effects run. Refreshing the drawing does not require repeating events that were already crossed.

## Resource and trust boundaries

One plan supports at most 10,000 channels, 20,000 channel groups, 100,000 keyframes, 10,000 events, 1,000 direct children and eight nesting levels. Repeated child instances count again toward the combined limits. A channel string can contain at most 4,096 characters and 64 numeric fields. Captured values and event metadata together are limited to 2 MB, while each event payload is limited to 4,096 values, 16 nesting levels and 64 KiB.

Descriptor objects, keyframe arrays and event data are inspected without running property getters. They are data rather than executable instructions. Easing, interpolation and modifier functions are different because your application deliberately supplies them as trusted callbacks.

Authored and sampled times stay within zero to 86,400 seconds. Infinite repetition does not allocate infinitely many tracks because each query covers a finite range. Event queries return at most 10,000 crossings and inspect at most 100,000 cycle, event and child steps. A query that requires more work is rejected even if its source description is small.

Compilation groups and sorts intervals for each channel. Sampling then uses a binary search to find the relevant group rather than replaying every earlier track. Local CPU measurements are recorded in `artifacts/anime-parity/native-timeline-kernel.json`. They measure numeric sampling work in Node and do not establish browser frame rate, graphics completion or physical-device performance.

## Prepared positional sampling

For repeated sampling, `timeline.prepare()` captures the current validated plan as a read-only `PreparedTimeline`. Its `channels` array gives the names whose current values appear at matching indexes in each sample's `values` array. This avoids constructing a separate named-property record for every sample.

A prepared sample also contains `localTime`, `iteration`, `direction` and `duration`. Each sample owns a new read-only values array, while samples from the same prepared plan share their channel layout. In the following example, the first channel is `x` and its value halfway through the segment is 50.

```js
const motion = createTimeline().add({x: {from: 0, to: 100, duration: 1}});
const prepared = motion.prepare();
const packet = prepared.sample(.5);
console.log(packet.channels[0], packet.values[0]); // x, 50
```

Later edits leave an existing prepared capture unchanged. Call `prepare()` again when you want a capture of the new plan, or use the [timeline player](timeline-player.md) to prepare again automatically after edits. Preparation does not create a clock or retain renderer objects or setters.

Prepared sampling keeps the validation and callback order of named sampling. It resolves evaluator types while compiling and specializes single numeric tracks. Matching tracks may share an easing result only when their timing and library-owned curve configuration are equivalent. User callbacks and modifiers keep their individual invocation order and are not treated as pure because of user-supplied tags or function properties.

Every resulting value still passes its bounds check. Indexed values reduce record construction rather than caching trusted callback results or skipping validation. Named `sample()` and `valueAt()` remain available when property names are more convenient than array positions.
