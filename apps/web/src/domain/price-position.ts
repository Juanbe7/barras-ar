/** Where the median falls between the minimum (0) and the maximum (1). */
export function positionInRange(median: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (median - min) / (max - min)));
}
