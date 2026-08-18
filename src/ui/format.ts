export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const abs = Math.abs(value);
  if (abs < 1000) return value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  const units = ['K', 'M', 'B', 'T'];
  let scaled = value;
  let unit = '';
  for (const next of units) {
    scaled /= 1000;
    unit = next;
    if (Math.abs(scaled) < 1000) break;
  }
  return `${scaled.toFixed(2)}${unit}`;
}
