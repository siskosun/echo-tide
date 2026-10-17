/** Hard-mode landing challenge. Preview options, reveal the actual bridge mid-flight. */
export const AIR_BRIDGE = Object.freeze({
  // Separate near and far catch windows; one fixed horizontal hold cannot
  // overlap both candidate rectangles at the same descent crossing.
  w: 80,
  // Width 80. Near/far must sit outside the 28px launch footprint,
  // yet remain catchable within the 620px/s jump arc at 240px/s sideways.
  near: 72,
  far: 170,
  backtrackWhenBlocked: 72,
  revealAfter: 0.16,
  maxCandidates: 2,
});

/**
 * Repeatable audit key, not a pseudo-human reviewer and not hidden long-term
 * randomness. The real browser samples a fresh 32-bit seed at room restart.
 */
export function airborneChoice(seed, levelIndex, nextId) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Airborne branch seed must be uint32');
  }
  if (!Number.isInteger(nextId) || nextId <= 0) {
    throw new RangeError('Echo id must be positive');
  }
  const level = Number.isInteger(levelIndex) ? levelIndex : 0;
  let value = (seed ^ Math.imul(nextId + level * 31, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value & 1) ? 'near' : 'far';
}
