# Studio instruments

Use the instruments in `explainerkit/sound/studio` when a score needs more than a simple tone. The module builds synthesizer patches, plucked strings, struck bars and bells, a percussion kit and instruments made from your own recordings. Each one responds to how hard a note is played and how long it is held, and each can be placed on a track of a [produced score](music-production.md).

An instrument is a value you create once and reuse. `playInstrument` renders a single note from it so you can audition a sound or build a sound effect. The module runs in Node and in browsers without third-party packages, and every note is computed from the settings and a seed, so the same call always returns the same samples.

```js
import {
  synthInstrument, pluckedInstrument, modalInstrument, percussionInstrument,
  sampledInstrument, layerInstruments, playInstrument, SYNTH_PATCHES,
} from 'explainerkit/sound/studio';
```

## Audition an instrument

Choose an instrument and press play. The figure builds the instrument in your browser and renders a short phrase with `playInstrument`, one call for each note.

```demo studio-instruments
Each phrase is scaled to the same peak level, so the comparison is about tone and not volume.
```

The example renders a harp note and reports its length. A pitch is a MIDI number or a note name such as `'D4'`, where `'C4'` is middle C. `velocity` runs from 0 to 1 and describes how hard the note is played. `duration` is the time in seconds the note is held before it is released.

```js
import {pluckedInstrument, playInstrument} from 'explainerkit/sound/studio';
import {encodeWav} from 'explainerkit/sound/mix';

const harp = pluckedInstrument({preset: 'harp'});
const note = playInstrument(harp, 'D4', {velocity: 0.7, duration: 1.5});
console.log(note.duration, harp.release);
const wavBytes = encodeWav({sampleRate: note.sampleRate, channels: note.channels});
```

The returned audio lasts for the held duration plus the instrument's `release`, which is the longest time a note keeps sounding after it is let go. `playInstrument` also accepts `sampleRate`, `gain` in decibels, `pan` from −1 to 1 and a numeric `seed`. Its `dynamics` option, from 0 to 1, sets the level of the performance expression that a score supplies with controller messages.

## Design a synthesizer patch

`synthInstrument(patch)` builds a subtractive synthesizer. Oscillators produce a harmonically rich wave, a filter removes part of it, and envelopes shape how the level and the filter change over the life of a note. A patch is plain data, so you can store it as JSON and vary one field at a time.

`SYNTH_PATCHES` holds twelve starting points: `warmPad`, `glassPad`, `airPad`, `choir`, `synthStrings`, `brass`, `subBass`, `deepBass`, `pulse`, `softLead`, `bell` and `electricPiano`. Spread one into a new patch and change what you need. The example darkens the pad and slows its attack.

```js
import {synthInstrument, SYNTH_PATCHES} from 'explainerkit/sound/studio';

const pad = synthInstrument({
  ...SYNTH_PATCHES.warmPad,
  name: 'dark pad',
  filter: {...SYNTH_PATCHES.warmPad.filter, cutoff: 600},
  envelope: {attack: 2.5, decay: 2, sustain: 0.85, release: 4},
});
```

| Field | Meaning |
| --- | --- |
| `oscillators` | One to four sources. Each has a `wave` of `sine`, `triangle`, `saw`, `square` or `noise`, a `level`, and a pitch offset in `octave`, `semitones` and `cents`. `unison` from 1 to 9 stacks copies that are `detune` cents apart and spread across the stereo field by `spread`. A square wave takes a `pulseWidth`. |
| `sub`, `noise` | The level of a sine one octave below the note and of added noise. |
| `fm` | Frequency modulation for sine oscillators. `ratio` sets the modulator's frequency relative to the note, and `index` sets its depth. The depth falls from full to `sustain` over `decay` seconds, which gives bells and electric pianos a bright strike. |
| `filter` | `mode` is `lowpass`, `highpass` or `bandpass` with a `slope` of 12 or 24 dB per octave. `cutoff` is in Hz at middle C, and `keyTrack` from 0 to 1 moves it with the pitch. `envelope`, `velocity`, `dynamics` and `lfo` are amounts in octaves by which those sources move the cutoff. |
| `envelope`, `filterEnvelope` | `attack`, `decay` and `release` times in seconds and a `sustain` level from 0 to 1. The first shapes the level and the second drives the filter. |
| `lfo`, `vibrato`, `tremolo` | A slow oscillator with a `rate` in Hz, a `delay` before it starts and a `fade` time. `vibrato` is its pitch depth in cents and `tremolo` its level depth. |
| `drift` | Slow random pitch wander in cents, which keeps held chords from sounding static. |
| `formant` | Vowel resonances for voice-like patches. `vowel` is `ah`, `oh`, `oo`, `ee` or `mm`. |
| `velocity`, `drive`, `width`, `gain`, `retrigger` | Velocity sensitivity from 0 to 1, saturation from 0 to 1, stereo width from 0 to 1, level in decibels, and whether each note starts its oscillators at the same phase. |

The saw and square oscillators are band-limited, which means their sharp edges are smoothed just enough to keep high notes free of the false tones that a naive digital wave produces. The filter keeps its tuning while the cutoff moves, so envelope sweeps do not click.

## Pluck, strike and hit

Three factories model instruments by how they make sound. Each one takes a `preset` and lets you override its fields.

`pluckedInstrument` sends a burst of noise around a short delay loop. The loop length sets the pitch, and a filter in the loop makes the upper partials fade first, as they do on a string. The presets are `harp`, `nylon`, `pizzicato` and `zither`. `decay` is the ring time in seconds at middle C, `brightness` runs from 0 to 1, and `pick` is the plucking position along the string from 0.02 to 0.5. With `ring: true` the string keeps sounding after the note ends, as a harp string does. With `ring: false` it is damped after `release` seconds.

`modalInstrument` adds together decaying partials, each with its own frequency ratio, level and decay. The presets are `celesta`, `glockenspiel`, `vibraphone`, `marimba`, `kalimba`, `musicBox`, `tubularBell` and `bowl`. `hardness` from 0 to 1 describes the mallet. A harder mallet or a faster strike puts more energy into the upper partials. To design your own bar or bell, pass `modes` as a list of `[ratio, level, decayScale]` entries.

```js
import {modalInstrument, pluckedInstrument} from 'explainerkit/sound/studio';

const softCelesta = modalInstrument({preset: 'celesta', hardness: 0.2, decay: 3.5});
const brightHarp = pluckedInstrument({preset: 'harp', brightness: 0.8, pick: 0.12});
```

`percussionInstrument` is a kit in which each MIDI pitch plays one sound. `PERCUSSION_SOUNDS` lists the ten sounds: `boom`, `taiko`, `frame`, `sub`, `rim`, `tick`, `shaker`, `swell`, `riser` and `fall`. The default kit, `PERCUSSION_KIT`, follows the layout below. A pitch that the kit does not map is silent.

| Pitch | Sound | Pitch | Sound |
| --- | --- | --- | --- |
| 35 | `sub`, a low sine drop | 43, 45, 47 | `taiko`, tuned higher in turn |
| 36 | `boom`, a large low drum | 42 | `tick` |
| 37 | `rim` | 44 | `shaker` |
| 38 | `frame`, a small hand drum | 49 | `swell`, a cymbal roll |
| 41 | `taiko`, tuned low | 52, 53 | `riser` and `fall`, noise sweeps |

The `swell`, `riser` and `fall` sounds follow the length of the note. A four-beat swell grows for four beats and rings out when the note ends. Pass your own `kit` to remap pitches. Each entry names a `sound` and may set `tune` in semitones, `gain` in decibels and `pan`.

## Build an instrument from recordings

`sampledInstrument(zones, settings)` plays recorded notes. A zone is one recording with the pitch it was played at. The instrument picks the nearest zone for each note and changes its playback speed to reach the requested pitch. Supply decoded audio with its sample rate, as described in the [music guide](music.md).

In the example, `celloNotes` is an array you prepared in which each entry has decoded `pcm` and the `rootPitch` of that recording.

```js
import {sampledInstrument} from 'explainerkit/sound/studio';

const strings = sampledInstrument(
  celloNotes.map(({pcm, rootPitch}) => ({pcm, rootPitch})),
  {
    name: 'string section',
    sustain: 'loop',
    attack: [0.4, 0.09],
    release: 0.55,
    ensemble: {voices: 6, detune: 18, spread: 0.85},
    brightness: {low: 2200, high: 15000},
  },
);
```

A zone may limit itself to a `pitch` range and a `velocity` range, each written as `[low, high]`. Velocity ranges let a soft recording play quiet notes and a firm recording play loud ones. `maxShift` is the largest change of pitch allowed in semitones, 14 by default. A note that no zone can reach is silent, and the instrument's `range` reports the pitches it covers.

| Setting | Meaning |
| --- | --- |
| `sustain` | `'hold'` plays each recording once. `'loop'` repeats the middle of the recording for as long as the note is held, which lets a two-second bow stroke play a ten-second note. The instrument searches for a loop point where the wave lines up with itself and crossfades the join. |
| `attack`, `release` | Fade times in seconds. `attack` may be `[quiet, loud]`, so soft notes start gently. |
| `dynamicRange` | The level difference in decibels between the softest and loudest velocity. The default is 30. |
| `brightness` | Low-pass cutoffs in Hz for quiet and loud playing. Acoustic instruments are duller when played softly, and this restores that link when one recording covers many dynamics. |
| `ensemble` | Turns one recording into a section. `voices` from 1 to 12 players start `scatter` seconds apart, `detune` cents apart and spread across the stereo field. With `neighbours: true` the players draw on the nearest three recordings, so each has a slightly different tone. |
| `vibrato` | `rate` in Hz, `depth` in cents, a `delay` before it starts and a `fade` time. |
| `mechanics` | Adds a short noise at the strike and a duller knock at the release, as a piano's hammers and dampers make. |

A bank holds at most 512 zones and 96 million samples across all its recordings. The quality of a sampled instrument depends on its recordings. A zone that is shifted by many semitones changes character, so record or select a note every three or four semitones where you can.

## Combine instruments

`layerInstruments(layers)` plays several instruments as one. Each layer names an `instrument` and may set `gain` in decibels and `transpose` in semitones. `from` and `to` limit a layer to a pitch range, and `blend` fades it out over that many semitones beyond the range. A `velocity` range limits it to soft or loud notes. The example assumes the `strings` instrument from the previous section.

```js
import {layerInstruments, synthInstrument, SYNTH_PATCHES} from 'explainerkit/sound/studio';

const lush = layerInstruments([
  {instrument: strings},
  {instrument: synthInstrument(SYNTH_PATCHES.synthStrings), gain: -17},
], {name: 'lush strings'});
```

A quiet synthesized layer under recorded strings fills in the sustain without replacing their tone. Up to eight layers can be combined.

## Limits

`playInstrument` accepts MIDI pitches from 0 to 127. Each instrument reports the pitches it is designed for in `range`, which is 24 to 108 for a plucked string and the reach of its zones for a sampled instrument. A single `playInstrument` note lasts at most 60 seconds before its release. Unknown setting names and out-of-range values are rejected when the instrument is created. An object that did not come from one of these factories is rejected with `SOUND_INSTRUMENT`.

The synthesized instruments are models with approximate parameters. They were checked for tuning, velocity response, repeatability and clipping. They have not been fitted to particular acoustic instruments, and a listening comparison with recorded libraries has not been made. For an acoustic piano or bowed strings, recordings played through `sampledInstrument` give the closest result.
