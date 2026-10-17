/** Predictable tide drift for the experimental flow mechanic, no RNG. */
export const TIDE = Object.freeze({
  period: 3.6,
  amplitude: 18,
  baseShift: 0,
});

/** Horizontal drift, bounded and continuous through tide phase cycles. */
export function tideShiftAt(time) {
  const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
  return TIDE.baseShift + Math.round(
    TIDE.amplitude * Math.sin((safeTime / TIDE.period) * Math.PI * 2),
  );
}

/** Readable hint, independent of game physics and kept deterministic. */
export function tideDirectionAt(time) {
  const shift = tideShiftAt(time);
  if (shift > TIDE.baseShift + 4) return 'right';
  if (shift < TIDE.baseShift - 4) return 'left';
  return 'center';
}
