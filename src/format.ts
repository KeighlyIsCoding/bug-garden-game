const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];

/** Short display for growing numbers: 999, 1.2K, 34.5M. */
export function formatNum(n: number): string {
  if (!isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  if (v < 1000) return sign + String(Math.floor(v));
  let i = 0;
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000;
    i++;
  }
  const digits = v >= 100 ? 0 : 1;
  // Floor rather than round so "1.0K" never shows for 999.96.
  const shown = Math.floor(v * 10 ** digits) / 10 ** digits;
  return `${sign}${shown.toFixed(digits).replace(/\.0$/, '')}${UNITS[i]}`;
}
