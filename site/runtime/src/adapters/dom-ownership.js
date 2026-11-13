// Shared across native WAAPI and sampled DOM projection; no global DOM singleton.
export const domOwners = new WeakMap();
