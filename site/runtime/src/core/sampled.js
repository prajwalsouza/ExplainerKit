// Frames a scene produced itself. Their nodes already carry complete, validated properties, so a
// consumer may run the renderer's light inspection instead of a defensive deep copy.
const frames = new WeakSet();
export const markSampled = (frame) => {
  frames.add(frame);
  return frame;
};
export const isSampled = (frame) => frames.has(frame);
