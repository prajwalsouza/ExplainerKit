import { assert, number, text, options } from '../core/validate.js';

const mark = /\p{Mark}/u,
  space = /^\s+$/u;
function simpleGraphemes(value) {
  const parts = [];
  let regional = 0,
    join = false;
  for (const c of value) {
    const cp = c.codePointAt(0),
      previous = parts.at(-1),
      isRegional = cp >= 0x1f1e6 && cp <= 0x1f1ff;
    const attached =
      mark.test(c) ||
      cp === 0xfe0e ||
      cp === 0xfe0f ||
      (cp >= 0xe0100 && cp <= 0xe01ef) ||
      (cp >= 0x1f3fb && cp <= 0x1f3ff) ||
      (cp >= 0xe0020 && cp <= 0xe007f) ||
      c === '\u200d';
    if (
      previous !== undefined &&
      (attached || join || (previous === '\r' && c === '\n') || (isRegional && regional % 2 === 1))
    )
      parts[parts.length - 1] += c;
    else parts.push(c);
    join = c === '\u200d';
    regional = isRegional ? regional + 1 : 0;
  }
  return parts;
}
/** Preserve all text and offsets; Intl.Segmenter is preferred over a bounded fallback. */
export function segmentText(value, spec = {}) {
  options(spec, ['split', 'locale', 'fallback'], 'text segmentation');
  text(value, 'kinetic text', 20000);
  const split = spec.split ?? 'words',
    fallback = spec.fallback ?? 'auto';
  assert(['words', 'graphemes'].includes(split), 'INVALID_TYPOGRAPHY', 'split must be words or graphemes.');
  assert(
    ['auto', 'simple', 'error'].includes(fallback),
    'INVALID_TYPOGRAPHY',
    'fallback must be auto, simple or error.',
  );
  if (spec.locale !== undefined) text(spec.locale, 'text locale', 100);
  let method = 'fallback',
    raw;
  if (fallback !== 'simple' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(spec.locale, { granularity: split === 'words' ? 'word' : 'grapheme' });
    raw = [...segmenter.segment(value)].map((s) => s.segment);
    method = 'intl';
  } else {
    assert(fallback !== 'error', 'UNSUPPORTED_SEGMENTER', 'Intl.Segmenter is required by this text configuration.');
    raw = split === 'words' ? (value.match(/\s+|[^\s]+/gu) ?? []) : simpleGraphemes(value);
  }
  assert(raw.length <= 4096, 'RESOURCE_LIMIT', 'Text segmentation exceeds 4096 segments.');
  let offset = 0;
  const segments = raw.map((segment) => {
    const result = Object.freeze({
      text: segment,
      start: offset,
      end: offset + segment.length,
      whitespace: space.test(segment),
    });
    offset += segment.length;
    return result;
  });
  return Object.freeze({ text: value, split, method, segments: Object.freeze(segments) });
}

/** Pure onset/progress schedule; callers keep one existing story clock. */
export function textStagger(count, spec = {}) {
  options(spec, ['at', 'duration', 'stagger', 'order'], 'text stagger');
  number(count, 'text token count', 0, 2048);
  assert(Number.isInteger(count), 'INVALID_TYPOGRAPHY', 'Token count must be an integer.');
  const at = number(spec.at ?? 0, 'text onset', 0, 86400),
    duration = number(spec.duration ?? 0.6, 'token duration', 0.001, 3600),
    stagger = number(spec.stagger ?? 0.04, 'token stagger', 0, 3600),
    order = spec.order ?? 'forward';
  assert(
    ['forward', 'reverse', 'center'].includes(order),
    'INVALID_TYPOGRAPHY',
    'Text order must be forward, reverse or center.',
  );
  const indices = Array.from({ length: count }, (_, i) => i);
  if (order === 'reverse') indices.reverse();
  else if (order === 'center')
    indices.sort((a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2) || a - b);
  const starts = Array(count);
  indices.forEach((index, rank) => {
    starts[index] = at + rank * stagger;
  });
  const end = number(count ? at + (count - 1) * stagger + duration : at, 'text end', 0, 86400);
  return Object.freeze({
    starts: Object.freeze(starts),
    end,
    duration,
    sample(time) {
      number(time, 'text time', 0, 86400);
      return Object.freeze(starts.map((start) => Math.max(0, Math.min(1, (time - start) / duration))));
    },
  });
}
