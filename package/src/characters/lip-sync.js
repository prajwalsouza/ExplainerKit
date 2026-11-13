import { assert, number, options, safeCopy } from '../core/validate.js';
import { MOUTH_SHAPES } from './face.js';
import { lerp, smooth } from './timing.js';

/**
 * Import Rhubarb's documented JSON mouth-cue protocol. This reads timing data only: it never
 * opens metadata.soundFile, runs an executable or claims to recognize phonemes itself.
 * Protocol: https://github.com/DanielSWolf/rhubarb-lip-sync#json-format-json
 */
export function speechFromRhubarb(input, spec = {}) {
  options(spec, ['at', 'blend'], 'Rhubarb speech');
  const at = number(spec.at ?? 0, 'speech start', 0, 86400);
  const blend = number(spec.blend ?? 0.04, 'mouth blend duration', 0, 1);
  let parsed = input;
  if (typeof input === 'string') {
    assert(input.length <= 4 * 1024 * 1024, 'RESOURCE_LIMIT', 'Rhubarb JSON exceeds 4 MiB.');
    try {
      parsed = JSON.parse(input);
    } catch {
      assert(false, 'INVALID_LIP_SYNC', 'Provide valid Rhubarb JSON.');
    }
  }
  const data = safeCopy(parsed);
  options(data, ['metadata', 'mouthCues'], 'Rhubarb JSON');
  assert(
    Array.isArray(data.mouthCues) && data.mouthCues.length <= 40000,
    'INVALID_LIP_SYNC',
    'Use at most 40000 mouth cues.',
  );
  let previousEnd = 0;
  const cues = data.mouthCues.map((cue) => {
    options(cue, ['start', 'end', 'value'], 'mouth cue');
    const start = number(cue.start, 'cue start', 0, 86400);
    const end = number(cue.end, 'cue end', 0, 86400);
    assert(
      end > start && start >= previousEnd,
      'INVALID_LIP_SYNC',
      'Mouth cues must be ordered, positive and nonoverlapping.',
    );
    assert(Object.hasOwn(MOUTH_SHAPES, cue.value), 'INVALID_LIP_SYNC', 'Mouth shape must be A–H or X.');
    previousEnd = end;
    return Object.freeze({ start, end, value: cue.value });
  });
  let duration = previousEnd;
  if (data.metadata !== undefined) {
    options(data.metadata, ['duration', 'soundFile'], 'Rhubarb metadata');
    if (data.metadata.duration !== undefined) duration = number(data.metadata.duration, 'recording duration', 0, 86400);
    assert(duration >= previousEnd, 'INVALID_LIP_SYNC', 'A mouth cue exceeds the recording duration.');
    assert(
      data.metadata.soundFile === undefined || typeof data.metadata.soundFile === 'string',
      'INVALID_LIP_SYNC',
      'soundFile is optional descriptive text.',
    );
  }
  assert(at + duration + blend <= 86400, 'INVALID_LIP_SYNC', 'Speech must fit within the 24-hour scene limit.');
  const end = at + duration;
  return Object.freeze({
    source: 'rhubarb-json',
    at,
    end,
    cues: Object.freeze(cues),
    words: Object.freeze([]),
    sample(time) {
      number(time, 'speech sample time');
      if (time < at || time > end + blend) return null;
      let low = 0,
        high = cues.length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (at + cues[mid].start <= time) low = mid + 1;
        else high = mid;
      }
      const i = low - 1,
        cue = cues[i];
      let from = 'X',
        to = 'X',
        transition = 0;
      if (cue && time < at + cue.end) {
        from = i > 0 && cues[i - 1].end === cue.start ? cues[i - 1].value : 'X';
        to = cue.value;
        transition = cue.start;
      } else if (cue) {
        from = cue.value;
        transition = cue.end;
      }
      const weight = blend ? smooth((time - (at + transition)) / blend) : 1;
      return Object.freeze(
        Object.fromEntries(
          Object.keys(MOUTH_SHAPES.X).map((key) => [key, lerp(MOUTH_SHAPES[from][key], MOUTH_SHAPES[to][key], weight)]),
        ),
      );
    },
  });
}
