# Semantic sound for motion

Use `explainerkit/sound` to design an effect, choose a musical voice or render a soundtrack tied to authored motion. The module generates numeric audio samples called PCM and accepts recordings that your application has already decoded. It shares the [mixer and WAV tools](audio-mixing.md) and [media playback adapter](sound-playback.md). Importing or rendering does not play audio, open a device, fetch assets or install a clock. Render the soundtrack first, then attach it to a player when a viewer requests playback.

```js
import {
  soundEffect, note, chord, processSound,
  createSoundtrack, cueForMotion, analyzeSound, attachSoundtrack,
} from 'explainerkit/sound';

const arrival = {at: 1, duration: .6}; // share this with the visual move
const score = createSoundtrack([
  cueForMotion('whoosh', arrival, {options: {weight: .5, seed: 7}}),
  {effect: 'impact', at: 1.6, align: 'peak', options: {intensity: .5}},
  {chord: ['D4', 'F4', 'A4'], at: 2, duration: 1.2,
    options: {instrument: 'felt', velocity: .55}},
], {tempo: 110});
const pcm = score.render({duration: 5});
const sound = attachSoundtrack(player, pcm);
// In a trusted click handler: await sound.play();
```

The built-in catalogue generates sounds through ExplainerKit's own digital signal processing. It contains no recorded acoustic-instrument collection, learned differentiable DSP model or commercial sound-library assets. Numerical tests establish reproducibility and signal properties, while sound quality still needs listening. Listen to each sound in its intended scene before relying on it.

## Choose a sound by purpose

| Semantic cue | Typical authored role |
| --- | --- |
| `whoosh`, `swipe` | Use these for travel, a pan, a passing shape or a quick change. |
| `impact` | Use it for arrival, emphasis, contact or a heavier cut. |
| `tick`, `click`, `pop` | Use these for discrete changes, small controls or light arrivals. |
| `reveal`, `shimmer` | Use these for a reveal, glint or luminous accent. |
| `riser`, `reverse` | Use these to build anticipation before an event. |
| `stinger` | Use it as a short tonal punctuation. |

Choose a supported kind from `SOUND_EFFECT_KINDS`, then call `soundEffect(kind,options)`. Effects accept duration in .015–8 seconds, sample rate, seed, intensity, brightness, weight, pan, reverb and pitch in semitones. Defaults depend on the effect's purpose. These controls shape filtered noise, initial transients, resonant bodies, amplitude envelopes and spatial tails, so you can describe the intended cue without selecting every oscillator yourself.

`note('D4',{instrument:'felt',duration:1.1,velocity:.7})` accepts a scientific pitch name or MIDI pitch number. Choose `felt`, `mallet`, `pluck`, `bell`, `glass` or `pad` from `INSTRUMENT_KINDS`. These designed voices use damped resonances or a feedback string with excitation controlled by velocity. Their names describe intended timbre rather than a particular recorded instrument. Notes last .03–12 seconds, and `chord([...],options)` combines at most 16 pitches with limited stereo spread and strum. A guard below half the sample rate rejects unsupported high pitches and partials. Half the sample rate is the Nyquist frequency.

```js
import {musicPhrase} from 'explainerkit/sound';
const motif = musicPhrase(['D4', null, ['F4','A4'], 'C5'], {
  instrument: 'mallet', tempo: 108, stepBeats: .5, gate: .8, swing: .08, seed: 9,
});
```

`musicPhrase` renders the sequence you author, with null entries as rests and at most 128 steps. Set tempo, articulation and swing explicitly. It does not compose music automatically or run a generation service or pretrained model.

## Use existing recordings and sample banks

```js
import {sampleInstrument} from 'explainerkit/sound';
const keys = sampleInstrument([
  {id:'soft-c4', pcm:decodedSoftC4, rootPitch:'C4',
    pitch:[48,65], velocity:[0,.6]},
  {id:'hard-c4', pcm:decodedHardC4, rootPitch:'C4',
    pitch:[48,65], velocity:[.6,1]},
], {name:'My licensed keys', sampleRate:48000});
const accent = keys.note('D4',{velocity:.45,release:.12});
```

A sample bank copies decoded mono or stereo PCM together with explicit pitch and velocity zones. For a requested note, it chooses the nearest root covering those zones and resolves ties by stable ID. More recorded roots and velocity layers can improve timbre at the cost of more source data. Repitching uses a 16-tap windowed-sinc calculation within two octaves of a root to reduce aliasing. It changes natural duration along with pitch and does not provide transparent studio pitch or time stretching. Your application owns decoding and the rights to recordings. No Soundly, Rive, Cavalry or other proprietary pack is copied or downloaded.

Generators return `{channels,sampleRate,duration,metadata}`. The typed arrays belong to your application and remain editable, while consumers capture independent copies so later edits cannot change a saved soundtrack or sample bank. Sample rates are whole Hz from 8000 to 192000. Individual sound output and capture are limited to 16 million channel samples, with the operation's other limits checked separately.

## Shape an existing sound

```js
const softReverse = processSound(recordedWhoosh, [
  {type:'trim',from:.1,to:.8},
  {type:'reverse'},
  {type:'highpass',frequency:90},
  {type:'eq',frequency:2200,q:.8,gain:-3},
  {type:'pan',value:-.25},
  {type:'reverb',seconds:.7,mix:.12,tail:.3,seed:4},
  {type:'fade',attack:.008,release:.08},
  {type:'limit',threshold:.85},
]);
```

`processSound` applies up to 32 operations in order. The supported operations trim, fade, gain, pan or reverse audio, apply low-pass, high-pass, band-pass or peaking equalization, add delay or reverb, normalize sample peaks or limit sample values. Gain is a linear multiplier, equalizer gain is in decibels, and pan lies in [-1,1]. Delay and reverb retain tails within their limits unless you explicitly shorten them. The result is new PCM rather than an edit to the source arrays.

Reversing or shortening audio is a deliberate edit rather than transparent time stretching. The limiter controls individual samples without measuring true peaks between them. It does not provide an ITU-R BS.1770 loudness meter, normalization in loudness units relative to full scale, or mastering certification.

## Schedule against the existing motion

Call `createSoundtrack(cues,options)` to capture 1–512 cues against the same time used by the visual scene. Each cue contains exactly one `effect`, `note`, `chord` or decoded `sound`. Position it with `at` in seconds or `beat` at the declared tempo. Generated sounds accept `duration` in seconds or `beats`, and their `options` hold generator settings. Decoded PCM is processed before scheduling. Each cue needs a unique ID. Gain and role, chosen from `effect`, `music` or `narration`, feed the mixer that can lower other sounds under narration.

Alignment defaults to `start`, which places the clip's beginning at its cue time. Choose `end` to place its end there, or `peak` to align the center of the loudest 10 ms block measured by root-mean-square amplitude. Peak alignment has about ±5 ms block resolution and does not identify an exact waveform peak or universally perceived accent. A cue that would begin before zero is rejected. Move its anchor later or trim the source explicitly.

Share a trusted `{at,duration,ease?}` record with `cueForMotion` when sound should follow an authored move. By default it aligns to arrival, ending sweeps there and positioning impacts or punctuation by their energy anchor. Set `{anchor:'start'}` to begin the sound with the move. The helper does not decide narrative intent or assume that visual easing has an equivalent perceived sound envelope. Choose another cue or supply explicit PCM and timing when that relationship needs more control.

The soundtrack exposes captured cue descriptors, `.sample(seconds)` and `.render({from,duration,sampleRate})`. A sparse timeline can contain more than 32 cues, but at most 32 may overlap a .25-second render block plus narration-ducking margins. Captured source audio is limited to 32 million samples and output to 16 million. Rendering uses the mixer with its ducking and resampling limits, and `clippedSamples` reports out-of-range output without applying an implicit limiter.

Identical render requests reproduce PCM. Rendering segments can differ within floating-point interpolation tolerance, so use the same schedule when byte-identical WAV output matters. Changing the output sample rate uses the mixer's linear resampler. A shared source and output rate avoids that conversion in demanding work.

## Drive motion from sound without a live analyser clock

```js
const analysis = analyzeSound(pcm, {
  fftSize:1024, hop:.02, bands:[[40,180],[180,2000],[2000,12000]], channel:'mono',
});
ring.bind('r', {map:({time}) => 20 + 100*analysis.sample(time).rms});
```

`analyzeSound` calculates RMS amplitude, sample peak and frequency-band RMS in advance, then interpolates those features at the time requested by a scene callback. Frequency analysis uses a Hann window to reduce edge discontinuities before a fast Fourier transform. Choose a power-of-two `fftSize` from 128 to 4096, at most 16 bands, and a hop interval of .002–1 second. A 32-million FFT-work budget limits preprocessing.

Windows are centered at their sample time and padded with zero outside the clip. Adjacent bands include one edge and exclude the next, including Nyquist when applicable. Mono averages left and right and may cancel opposite-phase stereo, so select a channel explicitly when appropriate. These measurements do not provide perceived loudness, beat detection, music transcription or equivalence to Cavalry's A-weighted analysis.

For playback, use [the owned soundtrack adapter](sound-playback.md). For finished
video, pass the rendered WAV to the [existing exporter](audio-mixing.md).

## Render a soundtrack for the film exporter

To export an existing soundtrack `score` from Node, import `writeFile` from `node:fs/promises` and `encodeWav` from `explainerkit/sound/mix`. Render the required duration and write its encoded bytes to a WAV file, as shown below.

```js
const rendered = score.render({duration: 2});
const wav = encodeWav(rendered);
await writeFile('soundtrack.wav', wav);
```

Pass the WAV to the film exporter using the same timeline so the soundtrack and visual frames stay aligned.

```sh
npx explainerkit-export-film --url http://localhost:8080/your-film/ --out render/my-film --duration 2 --video --audio soundtrack.wav
```

`encodeWav` accepts mixer or soundtrack render results and encodes only `sampleRate` and `channels`. The documented `duration`, `clippedSamples` and `metadata` do not change WAV bytes. PCM validation and clipping still apply, and unknown options are errors. The exporter requires ffmpeg to combine audio with video. Choose a new output directory inside an existing parent, then consult [audio mixing/export](audio-mixing.md) for offset and duration rules.

Validation includes numerical pitch/filter/impulse oracles, deterministic PCM,
FFT calibration, cue alignment, chunk rendering, actual browser activation,
seek/disposal and a generated audition catalogue. Physical-device audio,
listening-panel approval and commercial-library equivalence remain unverified.
