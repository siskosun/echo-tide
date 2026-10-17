/** Revealed only after the first echo landing. No route marker exists at spawn. */
export const ROUTE_FORKS = Object.freeze([
  Object.freeze({
    left: Object.freeze({ x: 300, y: 288, w: 28, h: 38, name: '左岸潮灯' }),
    right: Object.freeze({ x: 730, y: 136, w: 28, h: 38, name: '右岸潮灯' }),
  }),
  Object.freeze({
    left: Object.freeze({ x: 110, y: 440, w: 28, h: 38, name: '回程潮印' }),
    right: Object.freeze({ x: 825, y: 212, w: 28, h: 38, name: '前进潮印' }),
  }),
  Object.freeze({
    left: Object.freeze({ x: 100, y: 212, w: 28, h: 38, name: '左岸核心' }),
    right: Object.freeze({ x: 830, y: 288, w: 28, h: 38, name: '右岸核心' }),
  }),
]);

/** Identical seed + room give identical branch for audit. UI seed comes from CSPRNG. */
export function chooseRoute(seed, levelIndex) {
  if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= ROUTE_FORKS.length) {
    throw new RangeError('Unknown campaign room');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Route seed must be an unsigned 32-bit integer');
  }
  // Seed 0 preserves the original evidence-backed campaign routes L, R, L.
  const side = (((seed & 1) ^ (levelIndex & 1)) === 0) ? 'left' : 'right';
  return { side, objective: { ...ROUTE_FORKS[levelIndex][side] } };
}
