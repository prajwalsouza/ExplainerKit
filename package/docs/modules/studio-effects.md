# Studio effects and meters

Use `explainerkit/sound/studio` to shape decoded audio the way a mixing desk does. You can equalise a recording, control its dynamics, place it in a room, add movement or harmonic colour, and measure the result against a delivery loudness. The same effects run on every track, bus and master of a [produced score](music-production.md).

Every function here works on decoded samples and returns new samples. Nothing plays by itself. To hear a result, encode it with `encodeWav` from `explainerkit/sound/mix` or hand the samples to Web Audio. The module runs in Node and in browsers without third-party packages.

```js
import {processAudio, measureAudio, filterResponse, effectTail, EFFECT_TYPES} from 'explainerkit/sound/studio';
```

## Process a sound through a chain

`processAudio(input, chain)` runs a list of effects in order. The input is `{sampleRate, channels}` with one or two `Float32Array` or `Float64Array` channels. A single channel is treated as mono and copied to both sides. The call leaves the input untouched and returns stereo audio with the same sample rate.

Pick a chain below and compare the two players. The figure renders a plucked phrase and a drum in your browser, then runs the chain you chose with the same `processAudio` call your code would make.

```demo studio-effects
The upper row is the dry phrase. The lower row is the processed result, which is longer when the chain adds a tail. Both rows share one amplitude scale.
```

Each effect is a plain object with a `type` and its settings. The example builds one second of a 220 Hz tone, then removes rumble, evens out the level and adds a hall. `tail: 'auto'` appends enough silence for the reverb to ring out before processing starts.

```js
import {processAudio, measureAudio} from 'explainerkit/sound/studio';
import {encodeWav} from 'explainerkit/sound/mix';

const sampleRate = 48000;
const tone = Float32Array.from({length: sampleRate}, (_, i) => 0.4 * Math.sin((2 * Math.PI * 220 * i) / sampleRate));

const processed = processAudio({sampleRate, channels: [tone]}, [
  {type: 'eq', bands: [{type: 'highpass', frequency: 80, slope: 24}, {type: 'peak', frequency: 3000, gain: 2, q: 1.2}]},
  {type: 'compressor', threshold: -20, ratio: 3, attack: 0.01, release: 0.15},
  {type: 'reverb', preset: 'hall', decay: 2.8, mix: 0.25},
], {tail: 'auto'});

console.log(processed.duration, processed.reports[1].maxReduction, measureAudio(processed).truePeak);
const wavBytes = encodeWav({sampleRate: processed.sampleRate, channels: processed.channels});
```

The result holds `sampleRate`, two `channels`, the `duration` in seconds and one entry in `reports` for each effect that ran. A compressor, gate or limiter reports the gain it removed in decibels, so you can check that a setting did something before you listen. Add `bypass: true` to an effect to skip it without deleting its settings.

Four options change how the chain runs.

| Option | Meaning |
| --- | --- |
| `tail` | Seconds of silence added before processing, from 0 to 60. `'auto'` uses `effectTail(chain)`, which adds up the ring time of the reverbs, shimmers and delays in the chain, up to 30 seconds. The default is 0, which cuts a reverb off where the input ends. |
| `tempo` | The tempo in BPM, from 20 to 400. A delay needs it when its time is written as a note value. |
| `keys` | Named audio that a compressor or gate can listen to, described under [dynamics](#control-dynamics). |
| `curves` | `true` adds a `reduction` list to each compressor report, with one reading every 20 milliseconds. |

A value that can move during the sound accepts either one number or a list of `{time, value}` points in seconds. The value ramps in a straight line between points and holds the first and last values outside them. The filter and ladder `frequency`, the `width`, the `pan` and the `gain` effect accept points. A list holds at most 4,096 points.

## Shape the tone with filters

An equaliser changes the level of chosen frequency ranges. Move the controls to see what one band does to a signal that starts flat. The curve comes from `filterResponse`, which returns the level change in decibels at each frequency you ask about.

```demo studio-eq
The line under the figure is the band object to place in an `eq` effect.
```

| Effect | What it does | Main settings |
| --- | --- | --- |
| `eq` | A parametric equaliser with 1 to 24 `bands`. Each band has a `type` from `FILTER_TYPES`, a `frequency` in Hz, a `gain` in decibels from −36 to 36 and a width `q` from 0.1 to 30. | A `lowpass` or `highpass` band takes a `slope` of 12, 24, 36 or 48 dB per octave. |
| `filter` | One filter whose `frequency` can move while the sound plays. Its `mode` is `lowpass`, `highpass`, `bandpass` or `notch`. | `resonance` from 0 to 0.98 emphasises the cutoff. `lfo: {rate, depth}` sweeps the cutoff by `depth` octaves. `slope` is 12 or 24. |
| `ladder` | A four-stage low-pass filter with a saturating input, in the style of analogue synthesizer filters. | `frequency`, `resonance` from 0 to 1 and `drive` from 0 to 24 dB. |

The band types are `peak`, `lowshelf`, `highshelf`, `lowpass`, `highpass`, `bandpass`, `notch` and `allpass`. A peak raises or lowers a region around its frequency. A shelf raises or lowers everything on one side of its frequency. The bands use the [Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/) formulas, and a steeper cut is a chain of those sections arranged so that the response stays flat up to the cutoff.

```js
import {filterResponse} from 'explainerkit/sound/studio';

const bands = [{type: 'highpass', frequency: 200, slope: 24}];
console.log(filterResponse(bands, [200, 100, 50])); // about -3, -24 and -48 dB
```

## Control dynamics

Dynamics effects turn the level up or down in response to the signal itself. A compressor lowers the parts that rise above its `threshold`. With a `ratio` of 4, a signal 12 dB over the threshold comes out 3 dB over it. `attack` and `release` are the times in seconds the compressor takes to react and to let go.

| Effect | What it does | Main settings |
| --- | --- | --- |
| `compressor` | Lowers levels above the threshold. | `threshold` in dB, `ratio` from 1 to 100, `knee` in dB for a gradual onset, `attack`, `release`, `makeup` gain in dB or `'auto'`, `detector` as `'peak'` or `'rms'`, and `mix` for parallel compression. |
| `multiband` | Splits the sound at 1 to 3 `crossovers` and compresses each band separately. | `bands` lists compressor settings for each band from low to high, each with an optional `gain`. |
| `limiter` | Holds the output under a `ceiling` in dBTP. It looks ahead a few milliseconds so the gain is already down when a peak arrives. | `ceiling` from −24 to 0, input `gain` and `release`. |
| `gate` | Lowers levels below the threshold, which removes noise between notes. | `threshold`, `ratio`, `range` in dB, `hold` and `release`. |
| `transient` | Raises or softens note attacks and sustains without a threshold. | `attack` and `sustain`, each from −1 to 1. |

A true peak, measured in dBTP, is the highest level the waveform reaches between samples as well as on them. A limiter that only looked at the stored samples could still clip after conversion to analogue or to MP3, so the limiter and the meter both estimate the waveform at four times the sample rate.

A compressor or gate normally listens to the sound it is processing. Give it a `key` to make it listen to another signal instead, which is called sidechaining. The usual use is to lower music whenever a voice speaks. Pass the other signal in the `keys` option under the same name. It must use the same sample rate. In the example, `music` and `voice` are decoded audio at the same rate.

```js
const ducked = processAudio(music, [
  {type: 'compressor', key: 'voice', threshold: -30, ratio: 4, attack: 0.02, release: 0.4},
], {keys: {voice}});
```

`sidechainHighpass` removes low frequencies from what the detector hears, so a bass drum does not pull the whole mix down. A `key` that is not in `keys` is rejected with `SOUND_SIDECHAIN`.

## Add space and echoes

A reverb imitates the reflections of a room. The `reverb` effect builds its tail from sixteen delay lines that feed back into each other, with early reflections in front of them. `decay` is the time in seconds the tail takes to fall by 60 dB.

| Effect | What it does | Main settings |
| --- | --- | --- |
| `reverb` | An algorithmic room. `preset` is one of `room`, `chamber`, `plate`, `hall`, `cathedral` or `ambient`, and any field overrides the preset. | `decay` from 0.1 to 30 seconds, `size`, `predelay` in seconds, `damping` from 0 to 1 for a darker tail, and `mix` from 0 to 1. |
| `delay` | Stereo echoes with filtered feedback. | `time` in seconds or as a note value, `feedback` from 0 to 0.95, `mix`, and `pingPong: true` to alternate sides. |
| `shimmer` | Copies raised by one and two octaves, fed into a long reverb. | `decay`, `mix` and `semitones`. |

A delay `time` may be a note value such as `'1/4'`, `'1/8'` or `'1/16'`. Add `d` for a dotted note, which lasts half as long again, or `t` for a triplet. `'1/8d'` at 120 BPM is 0.375 seconds. Note values need the `tempo` option, and `noteSeconds(value, tempo)` returns the same conversion for your own use.

Instead of `mix`, a reverb accepts `wet` and `dry` levels in decibels. Use `mix: 1` when the reverb sits on a shared return in a production, where the dry sound reaches the mix by another path. `REVERB_PRESETS` lists the starting values of each preset.

## Add movement, colour and width

| Effect | What it does | Main settings |
| --- | --- | --- |
| `chorus` | Slowly detuned copies that thicken a sound. | `voices` from 1 to 6, `rate` in Hz, `depth` in seconds and `mix`. |
| `ensemble` | Three modulated delay lines, as in string machines. | `depth` and `mix`. |
| `flanger` | A very short swept delay with feedback. | `rate`, `depth`, `feedback` and `mix`. |
| `phaser` | Swept notches that move through the spectrum. | `rate`, `stages` from 2 to 12, `low`, `high` and `mix`. |
| `tremolo` | A periodic level change. | `rate`, `depth`, and `stereo` from 0 to 1 to move the two sides in opposition. |
| `pitchShift` | Changes pitch without changing duration. | `semitones` from −24 to 24 and `mix`. |
| `saturation` | Adds harmonics with a `curve` of `tape`, `tube`, `soft`, `hard` or `fold`. | `drive` in dB from 0 to 36 and `mix`. |
| `exciter` | Adds harmonics made from the upper band only, which brightens a dull recording. | `frequency`, `drive` and `amount`. |
| `bitcrush` | Reduces bit depth and holds samples for a coarse digital texture. | `bits` from 2 to 16 and `hold` in samples. |
| `width` | Narrows or widens the stereo image. 0 is mono and 1 leaves it unchanged. | `width` from 0 to 2, and `lowMono` in Hz to keep bass in the centre. |
| `pan` | Moves the sound between the left at −1 and the right at 1. | `pan`. |
| `haas` | Delays one side by a few milliseconds, which moves a sound sideways without changing its level. | `delay` in seconds and `side`. |
| `gain` | Changes the level in decibels. | `gain`. |
| `fade` | Fades the start and the end. | `in` and `out` in seconds. |

Saturation matches the output level to the input unless you set `output`, so an A/B comparison hears the added harmonics and not a volume change. The saturation and exciter curves run at twice the sample rate, which keeps the harmonics they create from folding back into the audible range as harshly.

## Measure the result

`measureAudio(audio)` returns the readings a delivery specification asks for. Loudness is reported in LUFS, a scale on which a change of one unit matches a change of one decibel in level. It weights frequencies roughly the way hearing does and ignores silent passages.

```js
const meters = measureAudio(processed);
console.log(meters.integrated, meters.truePeak, meters.range, meters.bands);
```

| Field | What it holds |
| --- | --- |
| `integrated` | Loudness of the whole sound in LUFS, measured in the manner of [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770). |
| `momentaryMax`, `shortTermMax` | The loudest 400 millisecond and 3 second windows. |
| `range` | The loudness range in LU between the quiet and loud passages, following the method of [EBU Tech 3342](https://tech.ebu.ch/publications/tech3342). |
| `truePeak`, `samplePeak` | The highest level between samples in dBTP and on samples in dBFS. |
| `rms`, `crest` | The average level in dBFS and the distance from it to the sample peak. |
| `correlation` | 1 when both sides are identical, 0 when they are unrelated and −1 when one is the inverse of the other. A value near −1 loses level when played in mono. |
| `dcOffset`, `clippedSamples` | The mean sample value and the number of samples beyond full scale. |
| `bands` | The share of energy in six ranges, in decibels relative to the total. `METER_BANDS` lists their edges. |

A file with one channel reads about 3 LU lower than the same signal on two channels, because loudness adds the power of the channels. The loudness filter is designed for the input sample rate, so readings at rates other than 48 kHz approximate the published coefficients.

## Limits and failures

One call accepts whole sample rates from 22,050 to 96,000 Hz, up to 900 seconds of audio and at most 64 effects. Sample values must be finite. Channels must be typed arrays of equal length, and the functions read them as plain data fields without running accessors.

An unknown effect type is rejected with `SOUND_EFFECT` before any audio is processed, and an unknown setting name is rejected when its effect is reached. If feedback or resonance settings make the signal grow without bound, the call stops with `SOUND_RANGE` instead of returning it. Calls are synchronous. Run long audio in a Web Worker so the page stays responsive.

These effects were checked numerically against known signals, including filter responses, compressor reduction, limiter ceilings, delay times and reverb decay. A listening comparison with commercial processors has not been made.
