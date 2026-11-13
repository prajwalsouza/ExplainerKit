# Produce a score

Use `arrangeMusic` and `produceMusic` from `explainerkit/music` to turn written parts into a finished stereo mix. You write each part in bars and beats, assign it an instrument, route the tracks through effects and shared reverbs, and set the loudness the result should reach. The output is audio you can place under narration, with separate stems for an editor who wants to rebalance it.

This guide builds on two others. [Studio instruments](studio-instruments.md) describes the instruments a track can play, and [studio effects and meters](studio-effects.md) describes the effects and the loudness readings. The [music guide](music.md) covers the score format itself and MIDI exchange. Everything here runs in JavaScript without third-party packages, in Node or in a browser.

```js
import {arrangeMusic, produceMusic, chordPitches, voiceLead, arpeggiate} from 'explainerkit/music';
```

## Hear three produced cues

The three cues below were written as code and rendered by `produceMusic`. Choose one and press play. The bars show the level of the finished mix, and the labels mark where each section of the cue starts.

```demo music-cues
The readings under the figure are the integrated loudness and true peak of the rendered file, followed by the number of tracks in its mix.
```

| Cue | Character | Length | Loudness | True peak |
| --- | --- | --- | --- | --- |
| First Light | A quiet opening that grows. Felt piano, strings, harp and soft pads in D major. | 1:45 | −16.0 LUFS | −1.0 dBTP |
| Undercurrent | Investigative tension in D minor. A filtered pulse, low strings, a piano motif with delay and taiko drums. | 1:39 | −15.0 LUFS | −1.0 dBTP |
| Horizon | An uplifting finale in C major. String ostinato, a broad violin theme, brass, harp and drums. | 1:38 | −14.0 LUFS | −1.3 dBTP |

Each cue plays 9 to 13 tracks through group buses, a shared hall and other returns, and a master chain. The pianos and most strings are recordings played through `sampledInstrument`. The pads, basses, brass, harp, bells and percussion are synthesized. The readings in the table are measurements of these renders. They show that the mix reached its loudness target without clipping. They do not judge the music, and a listening review by a composer or editor has not been recorded.

The recorded notes come from Alexander Holm's [Salamander Grand Piano v3](https://github.com/sfzinstruments/SalamanderGrandPiano) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), [Karoryfer × Bigcat Cello](https://github.com/sfzinstruments/karoryfer-bigcat.cello) under [CC0](https://creativecommons.org/publicdomain/zero/1.0/) and the violin of [VSCO 2 Community Edition](https://versilian-studios.com/vsco-community/) by Versilian Studios under CC0. The examples select, trim and filter the recordings. [Recording credits](../credits.md)

## Write parts in bars and beats

`arrangeMusic` builds a score from parts. Each note names its `bar`, its `beat` within the bar, a `pitch`, a length in `beats` and a `velocity` from 1 to 127. Bars and beats count from zero, so `{bar: 2, beat: 1.5}` is halfway through the second beat of the third bar. A pitch is a MIDI number or a note name such as `'F#4'`, and a list of pitches writes a chord.

Three helpers produce pitches so you can write harmony by chord name.

| Helper | What it returns |
| --- | --- |
| `chordPitches(symbol, {octave, inversion})` | The MIDI pitches of a chord such as `'Dm7'`, `'Bbmaj7'` or `'G/B'`, lowest first. `CHORD_SHAPES` lists the 17 chord qualities it understands. A slash chord puts its bass note underneath. |
| `voiceLead(chords, {voices, low, high, top})` | One voicing for each chord, chosen so that every voice moves as little as possible from the chord before. This is how a string section or a choir is usually written. |
| `arpeggiate(pitches, {pattern, steps, step, velocity, accent, every})` | Notes that play held pitches one at a time. `pattern` is `'up'`, `'down'`, `'updown'` or a list of indexes into the pitches. Each note has a `beat` offset, ready to place in a bar. |

The example writes eight bars. A pad holds four voice-led chords twice, a harp joins with arpeggios in the second half, and a drum marks those bars.

```js
import {arrangeMusic, voiceLead, arpeggiate, chordPitches} from 'explainerkit/music';

const chords = ['Dm', 'Bb', 'F', 'C'];
const voicings = voiceLead(chords, {voices: 4, low: 'D3', high: 'D5'});

const score = arrangeMusic({
  title: 'Sketch',
  tempo: 84,
  bars: 8,
  parts: [
    {
      id: 'pad',
      notes: [0, 4].flatMap((first) => voicings.map((pitch, bar) => ({bar: first + bar, pitch, beats: 4, velocity: 70}))),
      expression: [{bar: 0, value: 0.4}, {bar: 4, value: 0.7}, {bar: 7, value: 1}],
    },
    {
      id: 'harp',
      notes: chords.flatMap((chord, bar) =>
        arpeggiate(chordPitches(chord, {octave: 4}), {pattern: 'updown', steps: 8, step: 0.5, velocity: 64, accent: 12})
          .map((note) => ({bar: bar + 4, ...note}))),
    },
    {
      id: 'drums',
      percussion: true,
      notes: [4, 5, 6, 7].flatMap((bar) => [{bar, beat: 0, pitch: 36, velocity: 96}, {bar, beat: 2, pitch: 41, velocity: 70}]),
    },
  ],
});
```

The result is an ordinary score, the same frozen data that `createMusicScore` returns. You can edit its notes, save it as JSON or write it as a MIDI file with `writeMidi`. Each part becomes one track with the part's `id`.

An arrangement has these fields.

| Field | Meaning |
| --- | --- |
| `bars` | The length of the piece, from 1 to 2,000 bars. |
| `meter` | `[beats, unit]`, such as `[3, 4]` for three quarter-note beats in a bar. The default is `[4, 4]`. |
| `tempo` | One number in BPM, or a list of `{bar, beat, bpm}` entries. An entry with `ramp: true` changes the tempo gradually from the entry before it, one step each beat. The default is 90 BPM. |
| `parts` | From 1 to 15 parts. Each has an `id`, its `notes`, and optionally a `name` and a MIDI `program` number for other sequencers. |

A part can also carry performance instructions. `expression` is a list of `{bar, beat, value}` points from 0 to 1 that shape the level of held notes, so strings can swell and fade without new notes. `pedal: 'bar'` presses a piano's sustain pedal and renews it at every bar line, and a list of `{bar, beat}` positions places the changes yourself. `percussion: true` puts the part on the MIDI channel reserved for drums. These instructions are stored in the score as standard controller messages, so they survive MIDI export.

Two notes of the same pitch cannot overlap within a part, because one key or string cannot sound twice at once. When they would, the earlier note ends where the later one starts.

## Mix the parts

`produceMusic(score, production)` renders the score. Each entry in `tracks` names a score track by `id` and gives it an `instrument`. A score track without an entry is not played. The example continues from the score above and uses synthesized instruments, so it runs without any recordings.

```js
import {produceMusic} from 'explainerkit/music';
import {synthInstrument, pluckedInstrument, percussionInstrument, SYNTH_PATCHES} from 'explainerkit/sound/studio';
import {encodeWav} from 'explainerkit/sound/mix';

const mix = produceMusic(score, {
  seed: 'sketch',
  tracks: [
    {id: 'pad', instrument: synthInstrument(SYNTH_PATCHES.warmPad), gain: -8, output: 'synths', sends: {hall: -9}},
    {
      id: 'harp',
      instrument: pluckedInstrument({preset: 'harp'}),
      gain: -6,
      pan: 0.25,
      humanize: {timing: 0.01, velocity: 0.1},
      sends: {hall: -8, echo: -14},
    },
    {id: 'drums', instrument: percussionInstrument(), gain: -6, sends: {hall: -14}},
  ],
  buses: [{id: 'synths', effects: [{type: 'compressor', key: 'drums', threshold: -28, ratio: 3, release: 0.3}]}],
  returns: [
    {id: 'hall', effects: [{type: 'reverb', preset: 'hall', decay: 3, mix: 1}]},
    {id: 'echo', effects: [{type: 'delay', time: '1/8d', feedback: 0.4, mix: 1, pingPong: true}]},
  ],
  master: {
    effects: [{type: 'eq', bands: [{type: 'highpass', frequency: 30, slope: 24}]}],
    loudness: -16,
    ceiling: -1,
  },
  stems: 'buses',
});

console.log(mix.duration, mix.loudness, mix.truePeak, mix.stems.map((stem) => stem.id));
const wavBytes = encodeWav({sampleRate: mix.sampleRate, channels: mix.channels});
```

The printed loudness is within a few tenths of −16 LUFS and the true peak is at or below −1 dBTP. The stems are `drums`, `harp`, `synths`, `hall` and `echo`.

### Follow the signal

Sound moves through a production in four stages, and each stage has its own list.

1. A **track** plays its notes through its instrument, then through its own `effects`, then through its fader, which is the `gain` in decibels and the `pan` from −1 to 1.
2. A **bus** collects the tracks whose `output` names it, so that a group such as the strings can share one equaliser or compressor. A bus can output to the master or to a bus listed after it.
3. A **return** holds an effect that several tracks share. A track's `sends` set how much of it is copied to each return, in decibels. One hall reverb on a return places every instrument in the same room and costs one reverb instead of one for each track. Set the effect's `mix` to 1, because the dry sound already reaches the mix through the track.
4. The **master** receives the buses, the returns and every track that names no bus. Its `effects` run on the whole mix.

Every effect list takes the effects in the [effects guide](studio-effects.md). Inside a production, an automated value can be written with `{tick, value}` points as well as `{time, value}` points, and a delay's note values follow the tempo at the start of the score.

### Shape a track

| Setting | Meaning |
| --- | --- |
| `gain`, `pan` | The fader level in decibels and the stereo position. |
| `output` | A bus `id`. The default is the master. |
| `effects` | The track's own effect chain. |
| `sends` | Levels in decibels for each return, such as `{hall: -9}`. |
| `humanize` | `timing` moves each note by up to that many seconds, and `velocity` varies its strength by up to that fraction. Small values, such as 0.01 seconds and 0.1, keep a part from sounding mechanical. |
| `automation` | `gain` and `pan` as lists of points, each with a `value` and either a `tick` or a `time` in seconds. A gain point adds to the fader in decibels. |
| `transpose` | Moves every note by that many semitones. |
| `mute` | `true` silences the track but keeps its place in the mix. |

Humanizing and the random details inside instruments come from the production's `seed`. The same score, settings and seed always give the same samples, and a different seed gives a different performance of the same notes.

Expression points written in the arrangement reach the instrument as it plays. A sampled or synthesized instrument becomes both quieter and darker at low expression, which is closer to how a player shapes a phrase than a volume change alone. The sustain pedal extends notes until the pedal lifts.

### Duck one part under another

A compressor or gate with a `key` listens to another track or bus instead of its own input. In the example above, the synth bus is lowered each time the drum plays, which keeps the low end clear. The key names a track or bus `id`, and its sound is taken after that track's fader.

### Set the delivery level

The `master` settings finish the mix. `loudness` is a target in LUFS from −40 to −6. The production measures the mix, applies one gain change to reach the target and limits the peaks. Streaming platforms and broadcasters publish their own targets, so ask the editor who receives the file which value to use. `ceiling` is the highest true peak allowed, in dBTP. It defaults to −1, and `null` turns the final limiter off. Leave `loudness` out to keep the level the faders produce.

Raising a quiet, dynamic mix to a loud target makes the limiter work harder. The result's `reports.master` list ends with the limiter's report, and its `maxReduction` tells you how many decibels the loudest peak was turned down. A reduction above about 3 dB is usually audible, and the remedy is to compress or rebalance earlier in the chain.

## Read the result

| Field | What it holds |
| --- | --- |
| `channels`, `sampleRate`, `duration` | The stereo mix, its rate and its length in seconds. |
| `scoreDuration` | The length of the written score in seconds, without the tail. |
| `loudness`, `truePeak` | Integrated loudness in LUFS and true peak in dBTP. |
| `meters` | Every reading of `measureAudio` for the mix, including the loudness range and the stereo correlation. |
| `normalization` | The gain in decibels that the loudness target applied. |
| `clippedSamples` | The number of samples beyond full scale. It is zero whenever the limiter is on. |
| `tracks` | For each track, its instrument name, the number of notes played and its peak level after the fader. |
| `stems` | Separate stereo recordings of the mix's parts, described below. |
| `reports` | What each effect measured, grouped as `tracks`, `buses`, `returns` and `master`. |

The render continues after the last bar so that releases and reverbs can ring out. With the default `tail: 'auto'`, it stops a quarter of a second after the mix falls silent, with a short fade. Give `tail` a number of seconds from 0 to 40 to set the length yourself.

Stems let an editor change the balance later. `stems: 'tracks'` returns every track and every return. `stems: 'buses'` returns each bus that feeds the master, each track that feeds the master directly, and every return, which is the smaller set most editors ask for. Each stem has an `id`, a `kind` and two channels with the same length as the mix. Stems are taken before the master chain. When the master has no effects, no loudness target and no ceiling, the `'buses'` stems add up to the mix exactly.

## How the documentary cues were made

The three cues on this page were written as ExplainerKit code, arranged with `arrangeMusic` and rendered with `produceMusic` in Node, with FFmpeg decoding the recorded instrument notes. Each render wrote a WAV file, a MIDI file, the score as JSON and a report with the meter readings for the cue. Each cue took 19 to 24 seconds to render in Node 26 on the development machine. The cue scripts are kept in the development repository and are not part of the package.

Each cue file exports a `build` function that returns a score and its production settings. Read one to see how a longer piece is organised: chord progressions for each section, a melody written as rows of bar, beat, pitch, length and velocity, and one production object that routes the tracks.

## Limits and failures

A production renders at most ten minutes of score, 64 tracks, 16 buses and 8 returns, at whole sample rates from 22,050 to 96,000 Hz. `PRODUCTION_LIMITS` holds these values. The buffers of one render are limited to 256 million samples in total, and the synthesis work is bounded, so a very long or dense score is rejected with `RESOURCE_LIMIT` before or during rendering. Lower the sample rate, shorten the piece or request fewer stems.

Routing mistakes are rejected with `MUSIC_PRODUCTION` before any sound is rendered. They include a track that names an unknown score track, bus or return, an `id` used twice, a bus that outputs to an earlier bus, and a sidechain key that is not a track or bus. Arrangement mistakes, such as an unknown chord symbol or tempo entries that are out of order, are rejected with `MUSIC_COMPOSE`. A number outside its range, such as a note placed after the last bar, is rejected with `INVALID_NUMBER`.

`produceMusic` is synchronous and a full cue takes many seconds. Call it in a build step, or in a Web Worker when it must run in a page.
