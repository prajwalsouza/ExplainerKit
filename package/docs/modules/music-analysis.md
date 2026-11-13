# Time visuals to music

Use `explainerkit/music` to time an explanation to a piece of music. It can analyse a song your reader or your team supplies and report its beats, bars, chords, key, sections and moments such as drops and build-ups. It gives you a beat grid for snapping and pinning visual actions to those moments, and it can shorten or lengthen a song to fit an animation. For music you build from loops, it also plans a game-style adaptive score that changes state, layers and accents on the beat.

The module does the analysis in JavaScript with classical signal processing and no trained model. Results are estimates. They are good on clear, steady pop and electronic music and weaker on rubato, sparse or unusual material.

```js
import {analyzeMusic, musicGrid, retargetMusic, createAdaptiveScore} from 'explainerkit/music';
```

The analysis reads decoded audio and runs without third-party packages. Your application owns file selection, decoding and playback. To write music of your own instead of analysing a recording, start with the [music guide](music.md).

## Analyse a song

`analyzeMusic` reads decoded audio samples, often called PCM. Pass `{channels, sampleRate}` with one or two `Float32Array` or `Float64Array` channels. In a browser, decode a file the reader picked with the Web Audio API and take its first two channels. The example assumes `input` is an `<input type="file">` element on your page.

```js
const file = input.files[0];
const context = new AudioContext();
const buffer = await context.decodeAudioData(await file.arrayBuffer());
const pcm = {
  sampleRate: buffer.sampleRate,
  channels: [buffer.getChannelData(0), buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1))],
};
const analysis = analyzeMusic(pcm);
console.log(analysis.tempo.bpm, analysis.key?.name, analysis.events);
```

The call is synchronous. A four-minute song at 48 kHz took about four seconds in Node 22 on the development machine, so run it in a Web Worker in a page. `AudioContext` is not available inside a worker, so decode on the main thread, copy the channel arrays and post them to the worker.

One call accepts at most 900 seconds of audio, the value exported as `MAX_MUSIC_SECONDS`. Channels must have equal length and finite sample values, and the function refuses plain arrays, accessor properties and unknown options before doing any work.

Four options adjust the analysis. `tempoRange` bounds the tempo search in BPM and defaults to `[60, 200]`. `tempoHint` moves the centre of the tempo preference from about 120 BPM when you know roughly how fast the song is. `beatsPerBar` is `'auto'` by default, which chooses three or four, or you can fix it to 2, 3, 4 or 6. `chords` is `'triads'` for major and minor chords, `'sevenths'` to add dominant, major and minor sevenths, diminished and suspended-fourth chords, or `false` to skip chord labelling.

## Read the analysis

The result is frozen plain data. You can store it as JSON with `JSON.stringify` and load it later without the audio. Times are in seconds from the start of the file, and bar and beat numbers count from zero.

| Field | What it holds |
| --- | --- |
| `start`, `end` | The audible extent, where the sound rises within 30 LU of the song's integrated loudness. |
| `tempo` | The tempo in BPM, a confidence from 0 to 1, related candidate tempi such as half and double, and a local tempo every two seconds. |
| `meter` | Beats per bar and how clearly one beat stood out as the first of the bar. |
| `beats` | Each beat's time, bar number, position in the bar (0 is the downbeat) and accent strength. |
| `downbeats` | The times of the first beat of every bar. |
| `onsets` | Note and drum attacks with their strength. |
| `chords` | Chord segments, each with a name such as `Am`, a root from 0 (C) to 11 indexing `PITCH_NAMES`, a quality from `CHORD_QUALITIES`, a Roman numeral in the song's key and a confidence. |
| `key` | The best of 24 major and minor keys, such as `E minor`, with a confidence. |
| `tuning` | How many cents the recording sits above or below A440. |
| `sections` | Spans of similar music with a letter, bar count, energy, a role, any repeating chord progression and a local key. |
| `events` | Timed moments for staging, described in the next section. |
| `curves` | Series sampled every 0.1 s: loudness, short-term loudness, intensity, brightness, bass and onset density. |
| `loudness` | Integrated loudness in LUFS, measured in the manner of ITU-R BS.1770, and the loudest momentary value. |

Section letters group sections that sound alike, so two sections labelled `B` share harmony and texture. The letters do not say which section is a verse or a chorus. A section's `role` is one of `intro`, `outro`, `breakdown`, `peak` or `steady`, and it comes from the section's position and energy compared with the rest of the song.

The intensity curve combines loudness, onset density, brightness and bass into a value from 0 to 1 that describes how full the music feels. It is useful for driving the scale or brightness of a scene, but it is an ExplainerKit measure rather than a validated perceptual one.

## Find moments to stage

The `events` list marks the moments that most often deserve a visual change. Every event has a `type`, a `time`, a `strength` from 0 to 1 and the nearest `bar` and `beat`. Events that last have an `end`, and events found by a rule carry a `measure` string that shows the numbers behind them.

| Type | When it is reported |
| --- | --- |
| `start`, `end` | The audible start and end of the song. |
| `fade-in`, `fade-out` | Short-term loudness climbs or falls by 10 LU or more over the first or last six seconds. |
| `section` | A new section starts, with its `label` and `role`. |
| `drop` | A bar opens at least 3 LU louder and clearly heavier in the bass than the bar before it, and the music stays full. |
| `build` | Intensity rises steadily for two or more bars before a drop or a plateau. |
| `breakdown` | Two or more quiet bars follow a fuller passage. |
| `climax` | The four bars with the highest mean intensity. |
| `pause` | At least 0.2 s inside the song falls 25 LU below its integrated loudness. |
| `hit` | A single attack far stronger than its neighbours. At most 64 are kept, at least a beat apart. |
| `progression-change` | Two neighbouring sections loop different chord progressions. |
| `key-change` | Two neighbouring long sections are confidently in different keys. |
| `tempo-change` | The local tempo departs from the overall tempo by 4 % or more. |

These rules are heuristics that were checked on synthetic songs and a handful of recordings. Treat an event as a suggestion to look at, and listen before you depend on it. Drops and builds are clearest in electronic and pop music, where they are part of the style.

Listen to them before you rely on them. Play each moment from about three seconds before it and mark it as right, early, late or not a real moment. Those verdicts are the evidence the event rules still lack, so keep them when you tune a threshold.

## Pin actions to the music

`musicGrid(analysis)` builds a grid from the beats and bars. A grid answers where a time falls in the music, finds the next beat or bar, and resolves a list of actions to exact times. You can also build a grid for music whose tempo you already know with `musicGrid({tempo: 120, beatsPerBar: 4, start: 0.5, duration: 90})`.

```js
const grid = musicGrid(analysis);
const cues = grid.pin([
  {id: 'title', at: {bar: 0}},
  {id: 'diagram', at: {section: 'B'}},
  {id: 'tension', at: {event: 'build'}, snap: 'bar'},
  {id: 'reveal', at: {event: 'drop'}, beats: -0.5},
  {id: 'caption', at: 12.3, snap: 'beat', direction: 'next'},
]);
for (const cue of cues) if (!cue.missing) console.log(cue.id, cue.time.toFixed(2));
```

Each action needs an `at`. That can be a time in seconds, a grid position `{bar, beat, fraction}`, an event `{event, index, edge}` or a section `{section, edge}`, where a section is named by its letter or index and `edge` is `'start'` or `'end'`. The grid resolves `at` to a time, snaps it to the unit in `snap` when you give one, moves it by `beats` along the grid and finally adds `offset` seconds. The `reveal` cue above therefore lands half a beat before the first drop, which lets a visual anticipate the hit. Actions whose event or section does not exist come back with `time: null` and `missing: true`, so a song without a drop does not silently move your reveal. The result is sorted by time, and any `data` you attach is copied through. Use each resolved `time` wherever your scene takes a time, such as the `at` of a keyframe or a story cue.

Snap units are `bar`, `beat`, `half`, `third` and `quarter` for the grid and its subdivisions, plus `onset` and `section`. `GRID_UNITS` lists them. Half beats are the off-beats, and thirds suit swung or triplet feels. Subdivisions are spaced evenly between the detected beats, so they follow a drifting tempo.

`grid.position(time)` returns the bar, the beat within the bar, the progress through the beat and the bar, and the local tempo. `grid.pulse(time, {unit, decay})` returns 1 on each grid time and decays exponentially in between, which suits a scale or glow that kicks on the beat. Because both are plain functions of time, they work with seeking and with frame-by-frame export. In the example below, `dot` is a circle in your scene, and its radius kicks on every beat.

```js
dot.bind('r', {map: ({time}) => 8 + 6 * grid.pulse(time, {unit: 'beat', decay: 0.15})});
```

## Fit a song to your animation

`retargetMusic(analysis, {duration})` plans bar-aligned jumps that make the song last about `duration` seconds. It compares bars by section letter, chords and intensity, prefers jumps of whole four-bar phrases and keeps the first and last bars, so the intro and ending survive. The plan lists its `jumps` with their similarity and an `edits` list of source spans in output order. The result can still be up to about half a bar away from the target, which the plan reports as `residual`. When it runs long, `fadeOutAt` suggests where to begin a fade.

```js
const plan = retargetMusic(analysis, {duration: 45});
const fitted = renderMusicEdits(pcm, plan, {crossfade: 0.03, fadeOutAt: plan.fadeOutAt});
```

`renderMusicEdits` applies the edit list with short linear crossfades and returns new PCM at the source sample rate. Its output is limited to 32 million samples across channels, about five and a half minutes of stereo audio at 48 kHz. The module does not time-stretch, so the fitted song keeps its tempo and pitch. A song needs at least eight detected bars to be retargeted. Run a new analysis on the fitted audio if you want a grid for it.

## Build an adaptive, game-style score

Game music is usually cut into short clips that loop and follow each other, with layers that come and go and accents that land on the beat. `createAdaptiveScore` brings those techniques to an explainer. A score has clips, states that sequence them, transitions between states, layers and stingers.

```js
const score = createAdaptiveScore({
  tempo: 112,
  beatsPerBar: 4,
  seed: 7,
  clips: {
    intro: {bars: 2},
    calmA: {bars: 4}, calmB: {bars: 4}, fill: {bars: 1},
    busy: {bars: 4, exitCues: [8]},
    lift: {bars: 1, pickup: 1},
    ending: {bars: 2, tail: 4},
  },
  states: {
    calm: {play: ['intro', {loop: [{clip: 'calmA', repeat: 2}, {choose: ['calmB', 'fill']}]}]},
    busy: {play: [{loop: ['busy']}]},
    finish: {play: ['ending']},
  },
  layers: {drums: {from: 0.3, to: 0.6}, lead: {from: 0.6, to: 0.9}},
  transitions: [
    {from: 'calm', to: 'busy', at: 'bar', via: 'lift'},
    {from: 'busy', to: 'calm', at: 'exit-cue', fade: 2},
    {to: 'finish', at: 'clip-end'},
  ],
  stingers: {correct: {beats: 2, pickup: 0.5, at: 'beat'}},
});
```

A clip is a span of music measured in `bars` or `beats`. Its recording may start `pickup` beats before its first downbeat and ring on for `tail` beats after its end. Its `exitCues` are beat positions where a transition may leave it.

A state's `play` list works like a tracker's order list. An item can name a clip, repeat a nested `sequence`, `choose` one of several items at random or `loop` its items until a transition. Repeats nest up to eight levels. Random choices use the score's seed and never pick the same item twice in a row when another is available, so a loop varies without sounding random. When a playlist runs out, the state moves to its `next` state or the music ends.

Transitions say when a change requested by the explainer takes effect. `at` can be `'immediate'`, `'beat'`, `'bar'`, `{bars: n}` for the next n-bar phrase of the current clip, `'clip-end'` or `'exit-cue'`. A transition can play a `via` clip as a bridge, fade over `fade` beats, and set `match: true` to enter the new clip at the same point the old one had reached, which keeps synchronised alternative arrangements in step. The first matching rule wins in this order: an exact `from` and `to`, then `from` with any destination, then any source with that `to`, then a rule for every change. Without a rule, a change waits for the next bar.

Layers follow an intensity value from 0 to 1. A layer is silent below its `from` value, full above `to` and fades smoothly in between. Intensity changes take effect on the next beat and fade over `layerFade` beats, which defaults to two. Stingers are short accents placed over the score. Each one lands on the next beat or bar after the request, and its pickup plays before that point.

```js
const plan = score.plan([
  {at: 6.2, state: 'busy'},
  {at: 9, intensity: 0.8},
  {at: 14.4, stinger: 'correct'},
  {at: 30, state: 'calm'},
  {at: 52, state: 'finish'},
], {duration: 60, intensity: 0.2});
```

`plan` turns timed requests into a schedule. Each scheduled clip records its source position, start and end, fades, whether it was cut and its pickup and tail. The plan also lists layer gain keys, stinger times and markers for every state, clip, transition, intensity and stinger change. Markers are the score's own events, so you can drive visuals from the same moments with `score.grid(plan)` and `score.sample(plan, time)`. The plan is pure. The same score, seed and requests always give the same schedule.

`score.render(plan, sources, {sampleRate})` mixes your recordings for a plan. Give each clip either one PCM recording or an object of stems. A stem named after a layer follows that layer's gain, and other stems play at full gain. Give each stinger a recording under its own id. Each clip recording starts at its pickup, so its downbeat sits `pickup` beats in. All sources must use the render sample rate, and the output is limited to 16 million samples across both channels, about 166 seconds at 48 kHz. Render a long score in pieces with `from` and `duration`. Clips without a source are silent, and `clippedSamples` counts output samples outside −1 to 1 without limiting them.

## Use beats from a neural tracker

Neural beat trackers are more accurate than the module's own tracker, especially for downbeats, but they need a trained model and a runtime that ExplainerKit does not include. You can run one yourself and pass its beats to `analyzeMusic` with the `beats` option. The module then skips its own tempo and beat tracking and builds bars, chords, sections and events on your beats.

Give `beats` as an array of times in seconds, or as `{time, position}` records where position 0 is the downbeat and 1 is the next beat. When every beat has a position, the bars follow them exactly. When none has a position, the module infers the bars as usual. Beats must increase, number from 4 to 100000 and lie within the audio.

Beat trackers usually write a text file with one beat per line, a time and its position in the bar counted from 1. madmom's downbeat tracker writes this kind of file, and other trackers' output is easy to convert to it. `beatsFromText` reads it, converting the positions to start from 0.

```js
import {analyzeMusic, beatsFromText} from 'explainerkit/music';

const beats = beatsFromText(await (await fetch('song.beats')).text());
const analysis = analyzeMusic(pcm, {beats});
analysis.tempo.source; // 'external'
analysis.meter.source; // 'external' when the file had positions
```

The result records where its beats came from in `tempo.source` and `meter.source`, which are `'estimated'` or `'external'`. With external beats, `tempo.bpm` is the median beat spacing, `tempo.confidence` is 1 and `tempo.local` is empty, so the module reports no tempo changes.

## Limits and accuracy

The module's own tracker was measured against the GTZAN tempo and beat annotations on 100 tracks, the first ten of each of the dataset's ten genres. Its mean beat F-measure was 0.79, counting a beat as correct within 70 ms and ignoring the first five seconds. Its mean downbeat F-measure was 0.40. Its tempo was within 4 % of the annotated tempo on 72 % of tracks, and on 93 % when half, double, third and triple tempos also count. librosa 1.0.0's beat tracker scored 0.77, 69 % and 90 % on the same tracks. Results vary by style, from a beat F-measure of 0.95 on hip-hop to 0.58 on classical music.

Expect tempo errors by a factor of two or 3:2, misplaced downbeats in music with weak accents and chord labels that miss extended harmony. Downbeats are the weakest part, so pass beats from a neural tracker when bar-accurate staging matters. The event rules have not been measured against annotations at all.

Analysis, grids, plans and edit lists are deterministic. Running the same input with the same options gives the same result, so a stored analysis stays valid as long as the audio does not change.
