# Live inputs and reactive scenes

Use `explainerkit/inputs` to connect observations to scene parameters or table rows. A source captures an observation, a mapping turns it into the quantity you need, and a binding applies that quantity to the scene. Sources are available for pointers, resizing, files, device motion and orientation, cameras and microphones. Your application can also supply observations directly.

Before connecting a source, create the scene parameter that its observations will control. The source acquires resources only when you call `start()`, and it does not choose what the data means or start the story clock. In the example below, the pointer's normalized horizontal position drives an ordinary parameter that sets the circle's x coordinate. The same approach can drive geometry, charts, rigs or a character's `drive()` call.

```js
import {scene} from 'explainerkit/core';
import {pointerInput, bindInputs} from 'explainerkit/inputs';

const drawing = scene({width: 640, height: 360});
const position = drawing.parameter(.5);
drawing.circle({y: 180, r: 20}).bind('x', {
  inputs: [position], map: value => value * 640,
});
const player = await drawing.mount(host, {controls: false});
const pointer = pointerInput(host, {id: 'cursor'});
const binding = bindInputs(drawing, [pointer], [{
  parameter: position,
  map: samples => Math.max(0, Math.min(1, samples[0].value.nx)),
}], {player});
await pointer.start();
// On application teardown:
binding.dispose();
pointer.dispose();
player.dispose();
```

The binding combines pending state updates in one microtask and validates every mapped value before applying them together. It then notifies the scene once. This continues to work while playback is paused, because live observations are separate from story time and do not rewind when the viewer seeks. Call `flush()` only when you explicitly need to apply a pending update synchronously.

```demo design-live-moth
The moth has a light dependency. Move the pointer over the night sky, or focus it and move the light with the arrow keys. The lamp and moth share the scene parameters even while the story clock is paused.
```

## Sources

| Factory | Observation value and ownership |
| --- | --- |
| `inputSource(options)` | Your application supplies JSON data with `push(value, metadata)`. It can receive data from an application-owned phone connection or other transport. |
| `pointerInput(element, options)` | It reports local `x/y`, normalized `nx/ny`, buttons, pressure, pointer type and active state. Leaving, canceling or blurring clears active state. Normalized positions are not silently clamped. |
| `resizeInput(element, options)` | It uses ResizeObserver to report content-box `width/height` in CSS pixels. Stopping disconnects the observer. |
| `deviceMotionInput(options)` | It reports nullable acceleration with and without gravity in m/s², rotation rate in rad/s and the observation interval in seconds. |
| `deviceOrientationInput(options)` | It reports nullable alpha, beta and gamma angles in radians and a nullable flag indicating an absolute reference. |
| `fileInput(element, options)` | Selecting or dropping a file produces `{name,format,rows}`. A failed read produces an invalid observation with an error. Drop handling stays within the bound element. |
| `dragInput(element, options)` | It reports `active`, local `x/y`, normalized `nx/ny`, item count, whether the drag carries `files`, and `dropped` when a drop occurs. It counts nested enter and leave events and clears on blur. It never reads the contents, so pair it with `fileInput` when a visual should react before the file lands. |
| `cameraInput(video, options)` | It owns the requested stream and supplied preview and emits `{width,height,mediaTime,frames}`. Stopping cancels frame callbacks, stops owned tracks and restores the preview assignment. |
| `microphoneInput(options)` | It owns capture and analysis and reports root-mean-square amplitude, peak, clipped sample count and share, sample rate and window size. Enabling `bands` adds a coarse spectrum. It never connects microphone input to speaker output. |

Camera and microphone `constraints` accept validated browser settings within resource limits. Media sampling defaults to 30 Hz and cannot exceed 60 Hz. The microphone defaults to `fftSize:1024` and `clippingThreshold:.99`. Its root-mean-square value, or RMS, measures normalized signal amplitude rather than calibrated sound pressure or perceived loudness.

Use `bands` when separate frequency ranges should control different visual parts. It accepts a whole number from 0 to 64 and defaults to zero. Each output is the mean of a logarithmically spaced frequency band within `bandRange`, which defaults to `[60, 8000]` Hz and is clamped to half the sample rate. That upper limit is the Nyquist frequency. Band values map the analyser's decibel range to 0–1 and run from lowest to highest frequency. They provide visual levels rather than a calibrated spectrum.

Use `waveform` to draw the signal itself. This option accepts 0–1024 points and defaults to zero. Each point retains the signed sample of largest magnitude in its slice of the analysis window, within [−1, 1]. Camera observations identify frames, while their pixels remain in the supplied video element. These sources capture observations without providing a face detector, gesture recognizer or augmented-reality tracker.

Native media and some sensors require secure contexts and explicit permission.
Call `start()` directly from the appropriate user action. Denial and unsupported
capabilities have distinct states. The adapters follow the native
[media capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
[sensor permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static)
and [resize observer](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
contracts. Physical device support and permission behavior vary.

## Processing and reactions

```js
import {microphoneInput, mapInput, smoothInput, bindInputs} from 'explainerkit/inputs';
const mic = microphoneInput({id: 'microphone'});
const amplitude = mapInput(mic, value => Math.min(1, value.rms * 5), {
  id: 'reaction-strength', unit: 'unitless',
});
const smoothed = smoothInput(amplitude, {halfLife: .08});
const strength = drawing.parameter(0);
const reaction = bindInputs(drawing, [smoothed], [{
  parameter: strength, map: rows => rows[0].value,
}], {player});
// Use strength with figure.drive(), a chart, colour or another ordinary binding.
// Start capture directly inside a user click handler:
startButton.addEventListener('click', async () => {
  const capture = mic.start();
  await amplitude.start();
  await smoothed.start();
  await capture;
});
```

`mapInput(source, map, options)` transforms one value and passes the immutable observation as the callback's second argument. Use `deriveInput(sources, map, options)` when a value depends on several sources. It supplies their latest valid observations only while they remain fresh. Starting a processor subscribes to sources but does not start their devices, so your application must start capture explicitly. Stopping or disposing the processor removes subscriptions and freshness timers. If mapping throws, the processor enters an error state rather than presenting an old successful result as current. A null result means unavailable data, and unknown source confidence remains null.

Use `smoothInput` to reduce changes in a numeric value over elapsed source time. Its half-life controls how quickly the filtered value approaches new observations, while its unit and coordinate space remain unchanged. It resets across epochs, missing data and explicit restarts. Check nullable sensor axes before calculating a shake magnitude so an unknown acceleration does not become zero.

Use `thresholdInput(source,{above,below,initial})` for a boolean that turns on at or above the upper threshold and turns off at or below the lower threshold. Between those marks, it keeps its current state. This behavior is called hysteresis.

```demo design-soup-fan
The soup has a fan. Drag the red bead up to 70 °C to turn it on, then back to 60 °C. The fan stays on at the same temperature where it was off before. Cool the soup to 50 °C to switch it off.
```

A character that turns toward the cursor or reacts to sound uses these generic
controls. The response pose is authored by the page. The input engine provides
the generic values and bindings used to drive it.

## Files and application-supplied data

```js
import {fileInput, bindData, inputSource} from 'explainerkit/inputs';
const rows = drawing.data([{id: 'a', value: 1}], {key: 'id'});
const files = fileInput(filePicker, {id: 'data-file'});
const dataBinding = bindData(rows, files, {
  map: sample => sample.value.rows.map(row => ({
    id: String(row.id), value: Number(row.value),
  })),
});
await files.start();

const phone = inputSource({id: 'paired-phone', unit: 'm/s²', space: 'device'});
await phone.start();
// The application's chosen transport supplies packets explicitly:
phone.push({x: 1, y: 2, z: 3}, {time: 12.4, confidence: null});
```

Call `readInputFile(file, options)` when you already have a file and do not need event handling. JSON must contain an array of row records or arrays within the data limits. CSV requires unique safe headers, valid quoting and consistent row widths, and its cells stay strings until your mapping converts them. Default limits are 1 MiB, 10000 rows and 128 columns. You may configure limits up to 16 MiB, 100000 rows and 1024 columns. A parsed file can still exceed the separate budget for capturing a retained observation. Neither source uploads, saves or fetches files. Selecting a newer file supersedes an unfinished read, and stopping prevents late results from being published.

`bindData` validates the entire mapped row set through `DataSource.replace` before replacing data. Bad rows or invalid observations leave the last committed data intact and are reported in its snapshot. Stopping or disposing it retains those last valid rows. Numeric parameter bindings have a different stale-value policy, with `stale:'release'` as the default and `hold` available when the last value should remain applied.

Phone sensors work on the device displaying the page. To use them on a desktop, your application must provide the connection and permission flow, then push received observations through `inputSource`. The module does not open a pairing server or assume that a remote timestamp matches the desktop's clock.

## Lifecycle, freshness and limits

Set `id`, `kind`, `unit` and `space` to describe a source, and use `maxAge` and `maxSamples` to control freshness and retention. A supplied `clock` must return seconds without moving backward. Caller-fed and media sources also expose `maxBytes`. Each start creates a new run identifier called an epoch. Observations carry that identifier together with sequence, source time, receipt time, units, coordinate space, validity and nullable confidence. Source time cannot move backward within an epoch. Comparing devices requires an explicit mapping between their clocks.

Await `start()` and inspect `snapshot().status/error` to distinguish success from acquisition failure or cancellation. The promise resolves true when running and false otherwise. Source states include idle, requesting, running, interrupted, stopped, denied, unsupported, error and disposed. Stopping releases resources and allows restart. Disposing prevents further use and is safe to repeat. Permission that arrives after cancellation immediately releases its acquired resources. Subscribers receive both status and observation changes, so compare epoch and sequence when you only want new observations.

Transient observations remain fresh for .5 seconds by default. Pointer and resize observations instead default to a finite 24 hours because an unchanged position or size remains useful. You may choose another policy. Derived inputs inherit the shortest upstream freshness unless explicitly configured, and expiry timers invalidate or release stale values even when no new hardware event arrives. A live binding reserves its target parameters within this module. Disposal restores earlier reader overrides while preserving authored keys and `set()` edits underneath them. Dispose that binding before another binding or manual override controller takes its channels.

A source retains only its latest observation unless you set `maxSamples`. History can hold up to 1024 samples within a retained-data budget that defaults to 1 MiB and reaches at most 16 MiB for configurable sources. The `dropped` count describes observations removed from history rather than unobserved physical events. Subscribers receive events synchronously, but parameter bindings deliberately combine state updates for presentation. Count events at the source rather than reading the last value of a combined binding. Retained history does not provide story-time replay.

Capture checks nesting depth, total values and bytes before retaining data. It rejects executable values and accessor properties, including indexed getters in arrays, without invoking them. A processor or binding can join at most 16 sources. At most 64 parameters commit together, and each source accepts up to 256 subscribers. Callback code belongs to the trusted application and must remain pure and perform limited work.

A binding can dispose automatically with its supplied player, but its sources remain application-owned so one consumer does not stop a shared input. Dispose sources and processors explicitly when the application view is removed. These operations do not record raw audio or video.

Use the source and binding API for supported live values such as pointer positions, microphone measurements, local files, and values pushed by your application. It does not provide synchronized recording and replay, advanced asynchronous analysis, or augmented-reality tracking.
