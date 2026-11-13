import { prepareTrack, trackValue, prepareKeyframes } from './timing.js';
import { assert, number, text, safeCopy, options } from './validate.js';
export class DataSource {
  #rows;
  #subscribers = new Set();
  #notify;
  #key;
  #limit;
  constructor(rows, { key, maxRows = 10000 }, notify = () => {}) {
    text(key, 'data key', 200);
    this.#key = key;
    this.#limit = number(maxRows, 'maxRows', 1, 10000);
    this.#notify = notify;
    this.#rows = this.#validate(rows);
  }
  get rows() {
    return this.#rows;
  }
  get key() {
    return this.#key;
  }
  #validate(rows) {
    assert(
      Array.isArray(rows) && rows.length <= this.#limit,
      'RESOURCE_LIMIT',
      `Expected at most ${this.#limit} rows.`,
    );
    const copy = safeCopy(rows);
    const keys = new Set();
    for (const row of copy) {
      assert(row && !Array.isArray(row) && typeof row === 'object', 'INVALID_DATA', 'Each row must be a record.');
      const key = row[this.#key];
      assert(
        (typeof key === 'string' && key.length > 0) || typeof key === 'number',
        'INVALID_KEY',
        'Each row needs a nonempty string or finite numeric key.',
      );
      assert(!keys.has(key), 'DUPLICATE_KEY', `Duplicate data key: ${key}`);
      keys.add(key);
    }
    return copy;
  }
  replace(rows) {
    const next = this.#validate(rows);
    // Prepare all dependent collections before committing any source or instance changes.
    const commits = [...this.#subscribers].map((prepare) => prepare(next));
    const totals = new Map();
    for (const c of commits) if (c.scene) totals.set(c.scene, (totals.get(c.scene) ?? 0) + c.delta);
    for (const [scene, delta] of totals) scene._capacity(delta);
    this.#rows = next;
    for (const commit of commits) commit();
    this.#notify();
    return this;
  }
  subscribe(prepare) {
    this.#subscribers.add(prepare);
    return () => this.#subscribers.delete(prepare);
  }
}
export class Parameter {
  #value;
  #initial;
  #min;
  #max;
  #notify;
  #tracks = [];
  #overridden = false;
  #extend;
  #override = null;
  constructor(value, { min = 0, max = 1 } = {}, notify = () => {}, extend = () => {}) {
    number(min, 'min');
    number(max, 'max');
    assert(max > min, 'INVALID_RANGE', 'Parameter maximum must exceed minimum.');
    this.#extend = extend;
    this.#min = min;
    this.#max = max;
    this.#value = number(value, 'value', min, max);
    this.#initial = value;
    this.#notify = notify;
  }
  get value() {
    return this.#value;
  }
  get min() {
    return this.#min;
  }
  get max() {
    return this.#max;
  }
  /** True while a reader override is layered over the keys and any set() value. */
  get overridden() {
    return this.#override !== null;
  }
  // `overridden` in a checkpoint records set(); `override` records the reader layer (null when released).
  checkpoint() {
    return Object.freeze({ value: this.#value, overridden: this.#overridden, override: this.#override });
  }
  restore(state) {
    const value = number(state.value, 'value', this.min, this.max),
      layer = state.override == null ? null : number(state.override, 'override', this.min, this.max);
    this.#value = value;
    this.#overridden = state.overridden === true;
    this.#override = layer;
  }
  sample(time) {
    return this.#override !== null
      ? this.#override
      : this.#overridden
        ? this.#value
        : number(trackValue(this.#tracks, time, this.#initial), 'sampled parameter', this.min, this.max);
  }
  set(value) {
    this.#value = number(value, 'value', this.min, this.max);
    this.#overridden = true;
    this.#notify();
    return this;
  }
  /** Restores authored keys and value. A reader override survives; only release() removes it. */
  reset() {
    this.#value = this.#initial;
    this.#overridden = false;
    this.#notify();
    return this;
  }
  /** Layer a reader value over the keys at every time until release(); set() and keys are kept underneath. */
  override(value) {
    const next = number(value, 'override', this.min, this.max);
    if (next !== this.#override) {
      this.#override = next;
      this.#notify();
    }
    return this;
  }
  release() {
    if (this.#override !== null) {
      this.#override = null;
      this.#notify();
    }
    return this;
  }
  /** Move to a value at a time, starting from wherever the previous move left off. */
  to(at, value, spec = {}) {
    return this.#commitTrack(this._prepareTo(at, value, spec));
  }
  _prepareTo(at, value, spec = {}) {
    options(spec, ['duration', 'ease']);
    const track = prepareTrack(
      this.#tracks,
      { to: value, at, duration: spec.duration ?? 1.1, ease: spec.ease ?? 'easeInOut' },
      this.#initial,
      { continuation: true },
    );
    number(track.from, 'from', this.min, this.max);
    number(track.to, 'to', this.min, this.max);
    return track;
  }
  _commitPrepared(track) {
    return this.#commitTrack(track);
  }
  _hasAnimation() {
    return this.#tracks.length > 0;
  }
  _setAuthored(value) {
    assert(!this.#tracks.length, 'CHANNEL_OWNED', 'Clear parameter animation before changing its authored value.');
    this.#initial = number(value, 'authored value', this.min, this.max);
    this.#value = value;
    this.#overridden = false;
    this.#notify();
    return this;
  }
  _clearAnimation() {
    this.#tracks = [];
    this.#notify();
    return this;
  }
  keys(keys) {
    return this._keys(keys, false);
  }
  replaceKeys(keys) {
    return this._keys(keys, true);
  }
  _keys(keys, replace) {
    const tracks = prepareKeyframes(replace ? [] : this.#tracks, undefined, keys, this.#initial);
    for (const t of tracks) {
      number(t.from, 'from', this.min, this.max);
      number(t.to, 'to', this.min, this.max);
    }
    this.#tracks = [...tracks];
    this.#extend(tracks.at(-1).end);
    this.#notify();
    return this;
  }
  animate(spec) {
    options(spec, ['from', 'to', 'at', 'duration', 'ease']);
    return this.#commitTrack(prepareTrack(this.#tracks, spec, this.#initial));
  }
  #commitTrack(track) {
    number(track.from, 'from', this.min, this.max);
    number(track.to, 'to', this.min, this.max);
    this.#tracks = [...this.#tracks, track].sort((a, b) => a.at - b.at);
    this.#extend(track.end);
    this.#notify();
    return this;
  }
}
