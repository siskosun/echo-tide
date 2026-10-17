/** Jump targets are selected and shown BEFORE takeoff, never midair. */
export const AIR_BRIDGE = Object.freeze({
  w: 80,
  // At launch the 28px player must cross a visibly meaningful gap.
  // The 620px/s jump arc at 240px/s horizontal speed can still catch
  // either landing when its surface is 76px above the takeoff platform.
  near: 135,
  far: 170,
  backtrackWhenBlocked: 135,
  // World-edge clamping must not compress a jump into a tiny step.
  minLaunchGap: 72,
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
