# Music

Use `explainerkit/music` to write instrumental music as editable data. This guide covers the score itself. You enter notes, repeat and vary phrases, exchange MIDI files with other software and render a stereo preview with the built-in voices. It also shows the modeled piano note in `explainerkit/sound`.

The other music guides build on the score described here.

| To do this | Read |
| --- | --- |
| Arrange parts in bars and beats and mix them into a finished cue with effects, shared reverbs, a loudness target and stems | [Produce a score](music-production.md) |
| Build synthesizer patches, plucked strings, bells, percussion and instruments made from recordings | [Studio instruments](studio-instruments.md) |
| Equalise, compress and add reverb to audio, and measure its loudness and true peak | [Studio effects and meters](studio-effects.md) |
| Analyse a song, pin visual actions to its beats and sections, fit it to a length or plan an adaptive score | [Time visuals to music](music-analysis.md) |

```js
import {createMusicScore, editMusicNotes, repeatMusicPhrase, readMidi, writeMidi, renderMusicScore} from 'explainerkit/music';
```

**Dependencies.** The music and sound modules run in JavaScript without third-party runtime packages. Score editing, MIDI import and export, synthesis and WAV encoding also run without a browser. For song analysis and sampled instruments, supply decoded PCM with its sample rate. In a browser, use Web Audio’s `decodeAudioData` to decode a supported file. Play rendered PCM through Web Audio, or encode it as WAV for an HTML audio element. Your application owns file selection, decoding and playback.

The guide’s hybrid piano demo uses Web Audio to decode the included MP3. The recorded cue uses the [credited piano and cello samples](../credits.md). Rebuilding the cue from the repository requires Node.js and FFmpeg to decode the source FLAC files. Regenerating the guide’s MP3 clips also requires FFmpeg’s `libmp3lame` encoder. Playing the guide and using the public score and synthesis APIs do not require FFmpeg.

## Compose an instrumental cue

Start with a score and enter notes by pitch, start tick and duration. A tick is a subdivision of a quarter note. With 480 ticks per quarter note, the second beat of a quarter-note-based measure starts 480 ticks after the first. MIDI pitch 60 is middle C. Velocity is an integer from 1 to 127 and controls how strongly the built-in instruments play a note.

Both versions below begin on D4. The source ends on A4, and the edited repeat moves the final note down to F4. Switch endings and press play to hear that one change.

```demo music-phrase
Horizontal position shows when a note starts. Each note's width shows its duration.
```

The following example enters a two-note phrase, copies it to the second bar and changes the copied ending. The original score stays frozen. At the chosen tempo, the second bar starts at 2.72 seconds.

```js
import {
  createMusicScore,
  editMusicNotes,
  musicScoreTime,
  readMidi,
  renderMusicScore,
  repeatMusicPhrase,
  writeMidi,
} from 'explainerkit/music';
import {encodeWav} from 'explainerkit/sound/mix';

const phrase = createMusicScore({
  ppq: 480,
  endTick: 1920,
  tempos: [{tick: 0, microsecondsPerQuarter: 680000}],
  tracks: [{
    id: 'keys',
    name: 'Felt keys',
    notes: [
      {id: 'opening', tick: 0, duration: 720, pitch: 62, velocity: 76},
      {id: 'ending', tick: 960, duration: 720, pitch: 69, velocity: 65},
    ],
  }],
});

const repeated = repeatMusicPhrase(phrase, {id: 'return', start: 0, end: 1920, at: 1920});
const secondEnding = repeated.tracks[0].notes.find((note) => note.tick === 2880);
const developed = editMusicNotes(repeated, [{id: secondEnding.id, pitch: 65, velocity: 71}]);

const midiBytes = writeMidi(developed);
const imported = readMidi(midiBytes);
const timing = musicScoreTime(imported.score);
const render = renderMusicScore(imported.score, {stems: true});
const waveBytes = encodeWav({channels: render.channels, sampleRate: render.sampleRate});
console.log(timing.secondsAt(1920), imported.warnings, render.clippedSamples, waveBytes.length);
```

### Work with an editable score

`createMusicScore` returns versioned JSON-compatible data. Each track holds notes and optional MIDI messages. A note has a stable score-local ID. Give notes and tracks IDs when another tool needs to refer to them, or let the library assign them. Save the data with `JSON.stringify` and reopen it by passing the parsed value to `createMusicScore`. MIDI exchange preserves the supported musical events and generates fresh IDs on import.

`repeatMusicPhrase` copies the notes with onsets in `[start, end)` to a new tick. You can select tracks, transpose the copy and scale velocities. Notes retain their durations, including those that end after the selected interval. Tempo, meter and controller messages remain at their authored ticks. `editMusicNotes` applies a batch by ID and rejects the batch when an ID is unknown or the resulting score is invalid. To layer parts, place notes on separate tracks at the same ticks. The full cue below layers a piano melody, its left hand, and two cello articulations.

`musicScoreTime` converts fractional ticks to seconds and back through the tempo changes. Its initial tempo is 120 BPM unless a change at tick zero specifies another value. Meter records the number and kind of beats per bar and survives MIDI exchange. The tempo map supplies the conversion between ticks and elapsed time. The score accepts up to 128 tracks and 100,000 notes, MIDI messages, tempo and meter entries combined.

The score position row below spaces quarter notes equally. The elapsed-time row shows the same beats played at 80 BPM in the first bar and 120 BPM in the second. Each bar still holds four beats.

```demo music-tempo
The first bar takes three seconds. The second takes two seconds.
```

### Open and render MIDI

Pass a `Uint8Array` to `readMidi`. It reads metrical Standard MIDI Files in formats 0 and 1 up to 8 MiB. It retains notes, track names, tempo, time signatures and channel messages. It reports skipped metadata, system-exclusive events and note-pairing problems by code and count. Notes with the same channel and pitch are paired in note-on order within each track. The writer rejects a nesting that would change those pairs on reimport. At a shared tick, it writes channel messages, then note releases, then new note onsets. A zero-length note releases just after its own onset group. Format 1 is the default for writing. Set `{format: 0}` for a score with at most one track. [Standard MIDI Files](https://midi.org/standard-midi-files)

The two rows below use the four notes from the phrase above. The second row comes from reading the actual file written by `writeMidi`. Compare the onset, pitch and duration of each note, then download the file to open it in a sequencer.

```demo music-midi
The comparison checks velocity as well as onset, pitch and duration.
```

`renderMusicScore` uses built-in felt, pluck, pad, bass and percussion voices. Use its `tracks` option to assign an instrument, gain and stereo pan to a track. The default instrument follows broad MIDI program families. Sustain pedal extends notes, while channel volume, pan and expression are sampled at each note's onset. Pitch bend, aftertouch and other channel messages remain in the score and MIDI export. The built-in voices do not interpret them.

For a recorded instrument, build a bank with `sampleInstrument` and pass it to the track as `sample.bank`. Give the bank and the score renderer the same output sample rate. Each zone pairs decoded audio with its recorded pitch and the note or velocity range where it should play. A sampled track uses the score's velocity to select the zone. Its `sample.release` controls how long the recording fades after the gate closes. It defaults to 0.3 seconds and accepts up to two seconds.

In this example, `score` has a track with the ID `'keys'`. The variable `pianoZones` holds decoded piano recordings with their root pitches and velocity ranges.

```js
import {renderMusicScore} from 'explainerkit/music';
import {sampleInstrument} from 'explainerkit/sound';

const sampleRate = 48000;
const bank = sampleInstrument(pianoZones, {sampleRate});
const result = renderMusicScore(score, {
  sampleRate,
  stems: true,
  tracks: [{id: 'keys', sample: {bank, release: 0.8}}],
});
```

`renderMusicScore` is a quick preview with one voice for each track. To give the same score studio instruments, effects, shared reverbs and a loudness target, pass it to [`produceMusic`](music-production.md).

The renderer starts at score tick zero and adds a configurable tail. Request `stems: true` to get stereo PCM for each track with the same sample rate and frame count as the master. The render includes peak and clipped sample counts. Lower the master or track gain if clipping occurs, then render again before encoding. `encodeWav` writes PCM16 WAV. Call the synchronous renderer in a worker for interactive pages. The default sample rate is 48 kHz. The renderer budgets up to 32 million samples across the master and track buffers and 24 million frames of voice synthesis. Up to 12 million of those voice frames may come from recorded samples. A sampled note may last up to 30 seconds including its release.

### Model a piano note

Start by playing Recorded A4, then compare it with Hybrid and Calibrated. Listen to the first instant of the strike and then to the way the note dies away. The hybrid keeps the first 140 milliseconds of the same recording. It fades into a synthesized decay between 140 and 240 milliseconds. That decay uses the measured level and phase of each partial in each stereo channel, so it follows the way the recorded oscillations rise and fall together. This is a demonstration for one recorded A4. For a score that needs an acoustic piano across pitches and playing strengths, use the recorded sample bank above. [Spectral modeling research](https://mtg.upf.edu/node/251) · [Recording credits](../credits.md)

```demo music-piano
The upper plot shows the first 35 milliseconds. The lower plot marks where the hybrid switches to a fully synthesized decay or where the key is released in the fully synthesized examples. Leave Add room off for the comparison. The recording is roughly level-matched to the calibrated model over the first 650 milliseconds.
```

Use `pianoNote` to explore the fully synthesized instrument. Turn up hammer hardness to shorten the simulated contact and strengthen the upper partials. Widen the unison to hear several strings at slightly different pitches. With the pedal down, the model keeps the damper raised after the key is released.

```js
import {pianoNote} from 'explainerkit/sound';

const soft = pianoNote('A4', {velocity: 0.64, hardness: 0.15, hold: 1.15});
const firm = pianoNote('A4', {velocity: 0.64, hardness: 0.9, hold: 1.15});
console.log(soft.metadata.hammerContactMs, firm.metadata.hammerContactMs);
```

The model returns decoded stereo samples and information about the simulated strike, partial frequencies and microphone delay. It accepts MIDI pitches 21 through 108 and whole sample rates from 16 to 96 kHz, with a work limit per note. From MIDI 48 through 77 it uses measured partial frequencies and decay envelopes from the Salamander recordings. It interpolates between measured keys and two dynamic layers. Pass `calibration: false` to hear the original formulas. An explicit `stiffness` option also lets you change how far the upper partials depart from integer multiples of the tuned fundamental. [Piano synthesis research overview](https://research.unipd.it/handle/11577/2471599) · [Salamander piano recordings](https://github.com/sfzinstruments/SalamanderGrandPiano)

The Fourier comparison below shows the recording and the two fully synthesized versions. It uses 128 ms windows. Switch from the strike to the body and late note to see which partials persist. Across five pitches held out of the calibration, the average error in the levels of partials two through eight relative to the fundamental fell from 11.8 dB to 7.1 dB. These curves measure level, so they do not show the timing of the strike or how the partials line up. The displayed A4 was used in the fit.

```demo music-spectrum
Compare the piano spectra, then choose bowed or plucked cello and violin at C4. Their recorded samples can be played directly.
```

The C4 recordings show why a bowed note needs different controls from a pluck. The bow can keep feeding the string after the attack, while the energy of a pluck falls away. A bowed model also needs to account for changes in bow speed, force, contact point and vibrato. Instrument body resonance shapes the sound before the microphone captures it. Echo and reverb can be auditioned separately so that room effects do not obscure an error in the note itself. These sample recordings contain their original microphone and room response. [Violin acoustics research](https://www.repository.cam.ac.uk/items/0c6f4466-3e5f-4b7a-abcf-23d3bd259025) · [Recording credits](../credits.md)

**Beneath the Surface** starts with a piano phrase, adds a bowed cello counterline and brings in plucked cello for the middle passage. The piano uses two recorded velocity layers. The cue's onset offsets, held notes and releases are part of the arrangement. Play the mix, then choose a stem to hear that part in isolation from the same position.

```demo music-stems
Each row shows short-interval peaks from one render. The stems share the master's start and sample count.
```

The cue uses Alexander Holm's [Salamander Grand Piano v3](https://github.com/sfzinstruments/SalamanderGrandPiano) under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and [Karoryfer × Bigcat Cello](https://github.com/sfzinstruments/karoryfer-bigcat.cello) under [CC0](https://creativecommons.org/publicdomain/zero/1.0/). The example selects, trims and filters the recordings. [Recording credits](../credits.md)

The cue was rendered by a script in the development repository, which writes the score, MIDI, stereo master and individual WAV stems. That script is not part of the package.
