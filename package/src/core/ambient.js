import { number, options } from './validate.js';
/** A pure ambient-clock input. Browser scheduling belongs to the mounted player. */
export class Ambient {
  /** @param {{rate?:number,offset?:number}} [spec] */
  constructor(spec = {}) {
    options(spec, ['rate', 'offset'], 'ambient input');
    this.rate = number(spec.rate ?? 1, 'ambient rate', 0, 16);
    this.offset = number(spec.offset ?? 0, 'ambient offset', 0, 86400);
    Object.freeze(this);
  }
  sample(seconds = 0) {
    return number(seconds, 'ambient seconds', 0, 86400) * this.rate + this.offset;
  }
}
