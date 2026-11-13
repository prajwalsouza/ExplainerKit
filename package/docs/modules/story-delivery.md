# Story scroll and asset delivery

A scroll story lets the reader choose the scene's time by moving through the page. Scrolling forward advances the picture, and scrolling backward samples the earlier frame again. A hold reserves extra scroll distance at one scene time so the image can wait while the reader studies text. Start with a scene and player, then attach that player to a story region whose sections explain the same sequence.

Try that relationship in the interactive explanation below.

```demo story-page
```

These modules are first-party JavaScript with no package dependencies. They drive the players you already have (SVG, Canvas, Three) rather than adding a second animation model, so one scene can be a film, a scroll story, or both.

## Author a story

```js
import {attachStory, storyTimeline} from 'explainerkit/story';

const acts = [
  {id: 'question', from: 0, to: 60, length: '220vh',
    holds: [{at: 24, length: '40vh'}]},
  {id: 'evidence', from: 60, to: 180, length: '400vh',
    holds: [{at: 110, length: '70vh'}, {at: 160, length: '40vh'}]},
  {id: 'answer', from: 180, to: 240, length: '180vh'},
];

const story = attachStory(player, {
  element: document.querySelector('.story'),
  sticky: document.querySelector('.story-stage'),
  acts,
  smoothing: .12,
  snap: 'holds',
});

// Release scroll ownership before the player's ordinary seek/play controls.
// story.dispose();
```

Put the stage inside the story region and keep it in normal document flow before attaching the driver. A typical layout places a sticky graphic beside readable paragraphs. Write semantic headings, captions, sources and a static fallback in HTML so the explanation remains accessible without waiting for JavaScript. The driver controls timing and placement rather than generating or hiding the article.

`attachStory(player, options)` returns `{timeline, disposed, refresh(), update({acts}), dispose()}`. Its `timeline` maps scroll positions to scene times using the current layout. Call `refresh()` after relevant layout changes to recompute geometry and adopt the player's duration, immediately sampling current scroll position without smoothing. Call `update({acts})` to replace acts without detaching. It validates and samples the replacement before changing the map or region height, so an invalid update keeps the current story.

Explicit act ranges must cover the duration. If ranges are implicit, extending the scene and refreshing redistributes time across the acts. Disposal removes listeners, observers, timers and frame requests, restores exactly the inline styles the driver owned, and releases the player. It is safe to repeat. Disposing the player also disposes the story.

| Option | Default | Meaning |
| --- | --- | --- |
| `element` | `player.element.parentElement` | It identifies the story region inside its scroll container. |
| `container` | The region's window | It chooses the native window or scrolling ancestor element. |
| `sticky` | `player.element` | It chooses a descendant stage, or `false` when your page manages pinning. |
| `acts` | Required | It supplies one to 256 ordered acts. |
| `smoothing` | `0` | It sets exponential visual smoothing in seconds within 0–2. |
| `snap` | `false` | Setting it to `'holds'` enables snapping. |
| `snapDelay` | `220` | It sets idle delay in milliseconds within 50–5000. |
| `snapDistance` | `.25` | It limits snapping distance to a viewport fraction within 0–1. |
| `onError` | Player error reporting | A scheduled failure detaches the driver before reporting the error. |

Use a number for length in display pixels, or a positive string ending in `px` or `vh`. For a story, vh means one percent of the selected scroll container's viewport height, including a nested container. The value is a story distance rather than a CSS expression passed through to the browser. Other expressions such as `calc()` and percentages are rejected.

Give every act a unique `id`, a `length` and any holds. You can omit `from` and `to` from all acts to divide player duration evenly. If any act supplies a range, every act must supply both endpoints in seconds. The ranges must be positive and contiguous, beginning at zero and ending at player duration. Explicit ranges let scroll distance and narrative time express different pacing choices.

Declare a hold with `{at, length}` inside its act, with hold times strictly increasing. The act's total length includes all hold distances, which must leave some positive distance for movement. The rest is distributed linearly across the act's time range. A hold may occur at either endpoint, and additional scrolling within it changes position without changing time. Total travel is limited to ten million pixels and each act accepts up to 128 holds.

The table shows a 0–10 second act spread over 1000 pixels, with a 200-pixel hold at 5 seconds. The hold consumes the middle distance while the two remaining intervals continue advancing time.

| Scroll position | Story time | Meaning |
| --- | --- | --- |
| 0–400 | 0–5 seconds | The first movement advances with scrolling. |
| 400–600 | 5 seconds | The picture stays still while the reader continues through the hold. |
| 600–1000 | 5–10 seconds | Scrolling advances the remaining movement. |

```demo story-hold
Scroll inside the panel. The bud waits at a hold while scrolling continues. The story clock stays at five seconds, shown by the graph's flat step.
```

The driver sets region height to `viewport height + total travel` and gives the selected stage `position: sticky; top: 0`. It restores style priorities on disposal. Set `sticky:false` when your page manages placement itself. Ancestor overflow, transforms, stage height, external style changes and competing layout rules can affect sticky behavior. The driver does not rewrite ancestors or inspect all CSS, so leave room for the stage and captions at small sizes. It does not clear or own the scroll container's position.

While attached, the story reserves the player's scroll driver. Another story, `attachScroll`, manual seeking or playback cannot take control until it detaches. A region or stage already in use is also rejected. If outside code releases the player driver, the old story cleans up without later releasing a replacement driver's ownership.

## Sample without a browser

```js
const map = storyTimeline(acts, {duration: 240, viewportHeight: 800});
map.length;            // Total scroll travel, in pixels
map.acts;              // Captured act IDs, times, and resolved intervals
map.spans;             // Moving and held intervals
map.holds;             // Pixel centers of held intervals
map.sample(1200);      // {position, time, act, index, holding}
```

`storyTimeline` can calculate the position-to-time map without a browser. Sampling clamps to the authored interval and returns frozen records, with the same result at a position whether reached forward or backward. Browser smoothing intentionally adds visual delay while moving but settles on that exact time and stops requesting frames. Calling `.refresh()` resolves immediately. No independent playback clock or perpetual polling loop is created.

Reduced motion disables smoothing and snapping. The default `reducedMotion:'continuous'` keeps the direct position-to-time mapping. Choose `reducedMotion:'stills'` to show each act's starting frame when the preference is enabled, with the story end showing its final frame. Keep headings, descriptions and skip links in HTML outside the graphic so the same information is available in stills mode. Native keyboard scrolling is not intercepted.

Enable snapping only when the authored holds benefit from moving the reader to a nearby settled view. After scrolling becomes idle, the driver selects the nearest held interval center within the configured distance and region, then makes one immediate native scroll adjustment. Visual smoothing remains separate. Wheel, touch, pointer and keyboard input cancel a pending snap, and a held pointer suppresses it. No handler prevents native scroll or keyboard defaults, and no custom fling or touch gesture is installed.

Resize events and ResizeObserver updates resolve viewport-based lengths again without changing authored times. Content inserted before the region may move its document position without triggering those observers, so call `refresh()` after such a layout change. Keep the stage inside the relevant scrolling ancestor.

## Load a few acts ahead

```js
import {preload} from 'explainerkit/assets/preload';

const assets = preload({acts: [
  {id: 'question', files: [
    {id: 'coast', url: '/art/coast.svg'},
    {id: 'observations', url: '/data/observations.csv'},
  ]},
  {id: 'evidence', files: ['/art/cell.svg']},
  {id: 'answer', files: []},
]}, {
  baseURL: location.href,
  ahead: 2,
  maxBytes: 16 * 1024 * 1024,
  maxConcurrent: 3,
});

// Creating the queue performs no network requests.
await assets.start('question');
const coastBytes = assets.get('coast'); // A caller-owned Uint8Array, or null
await assets.updateAct('evidence');
console.log(assets.status);
// assets.dispose();
```

To preload assets, list an ordered `acts` array with a unique act ID and a `files` array for each act. A file can be a URL string that also serves as its ID, or `{id, url, integrity?}`. An ID can appear in several acts only when its resolved URL and integrity agree. A manifest accepts at most 256 acts and 1000 distinct files and is captured without invoking accessor properties.

The loading window includes the current act plus `ahead` future acts. With `ahead:2`, that means three eligible acts. Moving backward changes the window too, and files no longer needed are evicted and fetched again if revisited. A shared ID stays cached while any eligible act needs it. The loader retains raw response bytes without decoding, uploading or disposing media objects that your application creates from those bytes.

| Option | Default | Meaning |
| --- | --- | --- |
| `ahead` | `2` | It selects an integer number of future acts within 0–16. |
| `maxBytes` | 16 MiB | It limits retained decoded response bytes within 1 byte–256 MiB. |
| `maxConcurrent` | `3` | It limits active fetch or read tasks within 1–16. |
| `baseURL` | `location.href`, if available | It resolves relative source URLs. |
| `origins` | `[new URL(baseURL).origin]` | It permits up to 32 explicit HTTP(S) origins without paths or trailing slashes. |
| `fetch` | Native `fetch` | It supplies a trusted streaming Fetch-compatible implementation for tests or host integration. |

The loader accepts HTTP(S) URLs only from the declared origins. It rejects URL credentials and executable, local-file or data schemes, omits request credentials and refuses redirects. Returned response origins are checked even when you supply a fetch implementation. Read-only status keeps source URLs, fragments, resolved URLs and expected hashes. Fragments identify a source locally and are not sent in HTTP requests.

The browser still enforces network permissions, Cross-Origin Resource Sharing and Content Security Policy. Allowing an origin is not a server-side request-forgery firewall. A server-side caller must separately restrict its network environment.

Supply one `sha256-<base64>` value as `integrity` when bytes must match an expected hash. The loader passes it to native fetch and independently verifies all bytes with Web Crypto before marking the file ready. Downloaded code is not evaluated or executed. Parse SVG, CSV, fonts or glTF explicitly with their importers after loading.

Inspect `assets.status` for a frozen `{disposed, act, bytes, maxBytes, active, assets}` snapshot. Each asset records `id`, `url`, `source`, `integrity`, `status`, `bytes` and `error`. Status is `idle`, `queued`, `loading`, `ready` or `error`, with a bounded message and stable code for failures. An evicted or canceled file outside the window returns to idle. Calling `.get(id)` returns an independent byte copy when ready and null otherwise. Unknown IDs throw. Your application owns those copies and any decoded resources.

Call `start(idOrIndex = 0)` or `updateAct(idOrIndex)` to select a loading window and await settled status. `.settled()` waits for the currently selected window to have no queued or loading files. If another update replaces the window, a pending promise follows that replacement rather than retaining the old act. Failures appear in status instead of rejecting completion promises. Invalid selections fail before state changes.

Use `.retry(id)` to retry a failed file in the active window after addressing its cause. No automatic retry loop hides a bandwidth or budget problem. Disposal aborts requests, releases retained bytes, settles waiters and prevents later loading or retrieval.

The byte budget includes cached files and chunks retained by active tasks. `Content-Length` permits early rejection, but each real chunk is checked before copying so missing or misleading headers cannot bypass the limit. Each asset permits at most 65,536 chunks, including empty chunks, to limit stream overhead. A response without a readable stream is rejected rather than read through an unlimited `arrayBuffer()`.

When concurrent tasks compete for the budget, first-arriving chunks reserve space and another eligible file may fail with `ASSET_BUDGET_EXCEEDED`. Reduce concurrency, raise the declared budget or split the act before retrying explicitly.

This budget limits retained bytes rather than exact heap use or network traffic. Browser network buffers and an already delivered chunk lie outside the cache. Combining chunks briefly requires another buffer, and returned copies and decoders allocate separately. An aborted task keeps its concurrency slot until cleanup finishes, so a custom fetch that ignores cancellation can delay the next window. Its late results still cannot be adopted by a replaced or disposed window.

## Connect loading to act changes

Connect the story and loader explicitly so only a change of act updates the loading window. The following frame listener remembers the active act to avoid submitting the same request every frame.

```js
let activeAct = null;
const off = player.on('frame', () => {
  const next = story.timeline.acts.find(act =>
    player.time >= act.from && player.time < act.to
  ) ?? story.timeline.acts.at(-1);
  if (next.id !== activeAct) {
    activeAct = next.id;
    void assets.updateAct(next.id);
  }
});
// off(); story.dispose(); assets.dispose();
```

The manifest IDs must match the authored story IDs. Decide in the application whether an unavailable asset uses a fallback, delays an optional visual, or displays a retry control. Loading never freezes native scrolling or mutates the story's clock.

## Arrive part-way

When a reader reloads or follows a link, the browser may restore scroll position after the story attaches. Choose an `arrival` policy for that return so the scene either shows the restored frame directly or briefly demonstrates how it reaches it.

| `arrival` | What the reader sees |
| --- | --- |
| `'jump'` (default) | It shows the restored-position frame immediately. |
| `'travel'` | It replays briefly from the story start to the restored position. |
| `'chapter'` | It plays the current act from its start. |
| `'top'` | It scrolls to the story start and waits there. |

```js
const story = attachStory(player, {
  acts,
  arrival: 'chapter',
  // Hold the replay at the act's start until the act can play (at most arrivalWait ms, default 4000).
  ready: (act) => assets.updateAct(act),
  onArrival: (plan) => console.log(plan.mode, plan.from, plan.to, plan.seconds),
});
story.arrival; // { mode, from, to, seconds, rewind, waiting, done } or null
```

```demo story-arrival
Drag the reader's light to where they reloaded, then hover a portal: the comet is that way in, replaying to their place.
```

An arrival is offered once when the story attaches, or on the first scroll within 1.5 s if the reader has not already used wheel, touch, keyboard or pointer input. Any such input finishes a replay at its target immediately. Replay duration defaults to 0.5–2.4 s according to how much of the story it covers and can be set with `arrivalSeconds`. Reduced motion turns every arrival into a jump. `attachScroll` accepts the same options and uses its `chapters` for chapter mode. Use `arrivalPlan` and `arrivalTime` when implementing your own driver.

## Read the reader's pace

Use scroll pace to choose an optional transition or decide what to load next. Story time still comes from position rather than velocity, so pace does not change exact seeking. This distinction lets the interface respond to fast browsing without changing the scene's authored time mapping.

```js
const story = attachStory(player, {
  acts,
  onPace: ({ pace, direction }) => {
    if (direction > 0 && pace !== 'reading') void assets.updateAct(nextActAfter(story.act));
  },
});
story.pace; // { position, velocity (px/s), speed (viewports/s), direction, pace }
```

```demo story-pace
Scroll the page slowly, then quickly, then stop. The field responds to the measured scroll speed.
```

Pace is classified as `still`, `reading`, `skimming` or `rushing` using boundaries of 0.05, 1.2 and 4 viewport heights per second. Set `paceBounds` to use different boundaries. `onPace` runs when the class or direction changes, and `story.pace` decays to still after scrolling stops. For a page with its own scroll handling, use `scrollPace()` directly through `pace.add(position, timeMs)` and `pace.sample(timeMs)`.

## Evidence and remaining boundaries

`tests/modules/story-arrival.test.js` covers pace classes and decay, arrival plans, replays from the start and the act, a late browser restoration, `ready` holds, reader interruption and `attachScroll`. `tests/modules/story.test.js` covers analytical hold distances, default/explicit act timing, window/nested geometry, reverse seeking, ownership, exact style restoration, keyboard/pointer snap cancellation, reduced motion, finite smoothing and cleanup. `tests/modules/preload.test.js` covers inert construction, look-ahead, shared IDs, eviction, budgets across concurrent streams, partial cancellation, stale completions, errors/retry, integrity, unsafe origins and immutable copies.

`tests/browser/story-checks.html` exercises real native window and nested scrolling, native sticky placement, SVG/Canvas reverse sampling, idle snapping and cancellation, native streaming fetch, and oversized response rejection. The retained keyboard fixture exposes `window.storyKeyboard` for an external native PageDown test. Node event mocks alone do not establish browser keyboard behavior. Mobile touch hardware, Safari/Firefox, transformed nested scrollers, full article accessibility, and real asset decode/upload performance remain separate validation work.

The browser contracts follow [CSS sticky positioning](https://www.w3.org/TR/css-position-3/#sticky-pos), [Fetch](https://fetch.spec.whatwg.org/), and [Streams readable readers](https://streams.spec.whatwg.org/#default-reader-class). Equal-distance hold allocation, smoothing constants, limits and idle snap policy are ExplainerKit engineering choices, not claims from those specifications.

## Announce acts

`attachStory(player,{onAct,reset})` reports the act under the scroll position (`story.act`) and lets a reader's hold-time edits survive scrolling with `reset:false`. See the [film kit](film-kit.md#story-acts).

## Step cards

Use `attachStory(player, {acts, steps: '.step'})` to place article cards along the story's scroll map. Supply `steps` as a selector matched inside the story region or as a list of elements. Name a card's act with `data-act`. Cards without that attribute use the acts in document order. Each act can have at most one card, and cards must sit inside the region, outside the stage. Invalid placement makes attachment or `update()` fail with `INVALID_STORY_STEPS` before any changes are applied.

The story wraps each card in a `div.explainerkit-step-slot[data-act]` positioned across that act's scroll distance, using `act.start` and `act.length`. It makes a statically positioned region relative so these slots have a positioning context. Within its slot, a card uses sticky positioning to remain visible for its act.

Set `--explainerkit-step-top` in your stylesheet to move the card vertically. Its default is `20vh`. Your stylesheet also controls horizontal placement, width, and appearance through `.explainerkit-step-slot`. The card belonging to the act under the scroll position receives the `active` class.

For a narrow scroll viewport, the story adds `explainerkit-story-narrow` to the region and places cards below the pinned stage by default. The `narrow` threshold defaults to `900` pixels. Set it to `0` to disable this adjustment. The region provides `--explainerkit-stage-height`, containing the stage's measured height, and the narrow default top is `calc(var(--explainerkit-stage-height) + 16px)`.

The story recalculates slots after resize, `refresh()`, and `update({acts})`. Calling `dispose()` moves the cards back to their original locations, removes the slots, restores inline styles the story changed, and restores each card's original `active` class.

Use `onProgress(id, u, index)` to update a readout inside a card as the reader moves through its act. The callback runs when the position within that act changes. Its `u` value runs from 0 at the start to 1 at the end, including any holds.

## Reader controls in a hold

Add controls to a hold when the reader should explore a parameter while story time stays fixed. The story displays those controls in the active step card during the hold's flat section of the scroll map. In this example, the range input changes `k` while the scene remains at time 53.

```js
attachStory(player, {
  steps: '.step',
  acts: [{ id: 'race', length: '320vh', holds: [{ at: 53, length: '110vh',
    controls: [{ parameter: k, min: .25, max: 10, step: .05, label: 'Try a size', format: v => `×${v}` }] }] }],
});
```

Each control contains a label, a range input with `aria-valuetext`, and an output value. The story groups them inside `div.explainerkit-story-controls[role=group]` in the active card. The parameter's range supplies the default `min` and `max`, and a hundredth of that range supplies the default `step`. Each hold accepts one to eight controls. Other counts produce `INVALID_STORY_CONTROLS`.

A control begins at its parameter's value at the hold time. Moving it calls `parameter.override(value)` and redraws the scene immediately without seeking. The override takes priority over authored values while the reader experiments. It survives a `reset:true` seek because `Parameter.reset()` preserves overrides.

Leaving the hold removes its controls and calls `release()` on every controlled parameter so authored keys take over. This also happens when the reader scrolls backward out of the hold, changes acts, updates acts, or disposes the story.

Set `holdControls:false` to supply your own interface. Read `story.hold`, which is either `{act, index, hold, at, controls}` or `null`, or observe it with `onHold(hold|null)`. The story still releases the parameters when the hold ends. You can use `holdControls(document, controls, {time})` to create the same control markup yourself. It returns `{element, dispose()}`, and its disposer releases the overrides it placed.

The pure `storyTimeline` function validates controls without rendering them. Its `sample()` result includes `hold`, the hold's index within the act or `null`, and `progress`. Each act also exposes its hold intervals through `act.holds`, using `{at, start, end}` in scroll pixels.

Call `Parameter.override(value)` when a temporary interaction should take priority over both authored keys and `set()`. While `overridden` is true, `sample(t)` returns that override at every time. Calling `release()` returns control to the underlying values. The story uses this mechanism so a reader can change a parameter during a hold without rewriting the animation.

Calling `reset()` restores keys and the authored value but preserves an override, which belongs to the code that placed it. A checkpoint records the override in its `override` field or stores `null` when none exists. Restoring a checkpoint restores that field too, so a failed reset draw can roll back exactly. A checkpoint without the field restores the parameter with no override.

The tests in `tests/modules/story-steps.test.js` cover these behaviors with DOM mocks. The browser fixture `tests/browser/story-checks.html` checks sticky pinning, the `active` class, a rendered control changing the frame, release when leaving a hold, and restoration on disposal.