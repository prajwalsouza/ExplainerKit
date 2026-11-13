// Bundled example data coordination. This module is not a runtime library API.
import { analyse } from './live-forms.js';

export async function readBundledResponse(response, name, limit = 2_000_000) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2_000_000)
    throw new Error('Sample byte limit must be between 1 and 2,000,000.');
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new Error(`${name}: sample exceeds ${limit} bytes`);
  }
  if (!response.body) return '';
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit || chunks.length >= 8192) {
        await reader.cancel();
        throw new Error(`${name}: sample exceeds ${limit} bytes or 8,192 chunks`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function companionFile(name) {
  if (name === 'friends-all-episodes.csv') return 'friends-all-conversations.csv';
  const match = /^friends-s(10|[1-9])-speakers\.csv$/.exec(name);
  return match ? `friends-s${match[1]}-conversations.csv` : null;
}

/** Prepare the complete paired sample before it can enter the live input source. */
export async function prepareBundledSample(entry, { loadText, parseText, sourceFor }) {
  const [name] = entry,
    companion = companionFile(name);
  const texts = await Promise.all([
    loadText(entry),
    ...(companion ? [loadText([companion, sourceFor(companion)])] : []),
  ]);
  const parsed = await parseText(texts[0], name);
  const conversation = companion
    ? await parseText(texts[1], companion)
    : /^(friends-s(?:10|[1-9])|friends-all)-conversations\.csv$/.test(name)
      ? parsed
      : null;
  if (!conversation) return parsed;
  if (!conversation.rows.length) throw new Error('The measured-turn companion has no rows.');
  for (const row of conversation.rows) {
    const turns = Number(row.turns);
    if (!Number.isSafeInteger(turns) || turns <= 0)
      throw new Error('Consecutive-turn counts must be positive integers.');
  }
  const pairWeights = {
    rows: conversation.rows,
    from: 'from',
    to: 'to',
    measure: 'turns',
    unit: 'consecutive speaker turns',
    detail: 'either direction',
  };
  const checked = analyse(parsed.rows, name.replace(/\.csv$/i, ''), pairWeights);
  return Object.freeze({ ...parsed, pairWeights: checked.pairWeights });
}

/** Commit only the last requested complete load; stale failures cannot replace a newer result. */
export function createLatestLoad() {
  let version = 0;
  return Object.freeze({
    cancel() {
      version++;
    },
    async run(prepare, commit) {
      const ticket = ++version;
      try {
        const value = await prepare();
        if (ticket !== version) return null;
        commit(value);
        return value;
      } catch (error) {
        if (ticket !== version) return null;
        throw error;
      }
    },
  });
}
