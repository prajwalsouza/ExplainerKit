// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Build a starter character by id. */
export function starter(id: any, overrides?: {}): any;
/**
 * Load a character from a pack: manifest is the parsed character.json; svg is the optional (possibly edited)
 * character.svg text. Without svg, the builder's own art is used.
 */
export function loadCharacterPack(manifest: any, svg?: null, spec?: {}): any;
/** The manifest written next to each character.svg. */
export function manifestFor(entry: any, def: any): {
    format: string;
    id: any;
    builder: any;
    options: any;
    about: any;
    rig: any;
    actions: string[];
    license: string;
    author: string;
    files: string[];
};
/** Rig builders a pack manifest may name. Packs carry data and art only, never code. */
export const BUILDERS: Readonly<{
    bean: typeof bean;
    stick: typeof stick;
    bird: typeof bird;
    fish: typeof fish;
    microbe: typeof microbe;
    quadruped: typeof quadruped;
    winged: typeof winged;
    jumper: typeof jumper;
    cow: (spec?: {}) => any;
    mouse: (spec?: {}) => any;
    dragonfly: (spec?: {}) => any;
    frog: (spec?: {}) => any;
}>;
/** The starter cast: every entry is a builder plus options, rendered to character.svg by the pack script. */
export const STARTERS: readonly Readonly<{
    options: Readonly<{
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory: string;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hairStyle: string;
        accessory: string;
        hair?: undefined;
        style?: undefined;
    } | {
        style: string;
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
    } | {
        palette: string;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    }>;
    id: string;
    builder: string;
    about: string;
} | {
    options: Readonly<{
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory: string;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hairStyle: string;
        accessory: string;
        hair?: undefined;
        style?: undefined;
    } | {
        style: string;
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
    } | {
        palette: string;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    }>;
    id: string;
    builder: string;
    about: string;
} | {
    options: Readonly<{
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory: string;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hairStyle: string;
        accessory: string;
        hair?: undefined;
        style?: undefined;
    } | {
        style: string;
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
    } | {
        palette: string;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    }>;
    id: string;
    builder: string;
    about: string;
} | {
    options: Readonly<{
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory: string;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hairStyle: string;
        accessory: string;
        hair?: undefined;
        style?: undefined;
    } | {
        style: string;
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
    } | {
        palette: string;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    }>;
    id: string;
    builder: string;
    about: string;
} | {
    options: Readonly<{
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory: string;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hairStyle: string;
        accessory: string;
        hair?: undefined;
        style?: undefined;
    } | {
        style: string;
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
    } | {
        palette: string;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    }>;
    id: string;
    builder: string;
    about: string;
} | {
    options: Readonly<{
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory?: undefined;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hair: string;
        hairStyle: string;
        accessory: string;
        style?: undefined;
    } | {
        palette: string;
        skin: string;
        hairStyle: string;
        accessory: string;
        hair?: undefined;
        style?: undefined;
    } | {
        style: string;
        palette?: undefined;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
    } | {
        palette: string;
        skin?: undefined;
        hair?: undefined;
        hairStyle?: undefined;
        accessory?: undefined;
        style?: undefined;
    }>;
    id: string;
    builder: string;
    about: string;
}>[];
import { bean } from './builds/bean.js';
import { stick } from './builds/stick.js';
import { bird } from './builds/creatures.js';
import { fish } from './builds/creatures.js';
import { microbe } from './builds/creatures.js';
import { quadruped } from './builds/families.js';
import { winged } from './builds/families.js';
import { jumper } from './builds/families.js';
