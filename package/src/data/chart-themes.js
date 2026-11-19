import { hsla, toHex } from '../color/index.js';
import { assert } from '../core/validate.js';

const paint = (h, s, l) => toHex(hsla(h, s, l));

const themes = Object.freeze({
  silk: Object.freeze({
    background: paint(228, 30, 3),
    text: paint(220, 16, 84),
    grid: paint(226, 14, 22),
    mark: paint(214, 26, 82),
    accent: paint(18, 100, 54),
    motion: 'silk',
  }),
  pearl: Object.freeze({
    background: paint(40, 33, 96),
    text: paint(230, 14, 22),
    grid: paint(36, 16, 84),
    mark: paint(228, 36, 32),
    accent: paint(10, 78, 50),
    motion: 'silk',
  }),
  paper: Object.freeze({
    background: paint(44, 35, 96),
    text: paint(183, 21, 18),
    grid: paint(166, 14, 76),
    mark: paint(166, 36, 34),
    accent: paint(16, 73, 39),
    motion: 'grow',
  }),
  midnight: Object.freeze({
    background: paint(224, 37, 11),
    text: paint(211, 71, 94),
    grid: paint(223, 29, 34),
    mark: paint(183, 61, 65),
    accent: paint(47, 93, 68),
    motion: 'grow',
  }),
  signal: Object.freeze({
    background: paint(230, 12, 4),
    text: paint(225, 12, 92),
    grid: paint(223, 8, 31),
    mark: paint(218, 11, 84),
    accent: paint(19, 100, 62),
    motion: 'trace',
  }),
});

/**
 * Return a built-in chart palette and its entrance style.
 * @param {'silk' | 'pearl' | 'paper' | 'midnight' | 'signal'} [name]
 */
export function chartTheme(name = 'paper') {
  assert(
    typeof name === 'string' && name.length <= 8 && Object.hasOwn(themes, name),
    'INVALID_OPTIONS',
    'Unknown chart theme.',
  );
  return themes[name];
}
