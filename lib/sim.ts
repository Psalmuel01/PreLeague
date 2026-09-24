// Simulated price paths for demo mode. Deterministic in (symbol, time) so a
// kick-off price captured on one page matches what every other page computes.
// Only ever used when the viewer switches on "Simulated prices", and the UI
// labels every simulated number as such.

const MIN = 60_000;
// Periods and amplitudes chosen so a 15-minute round moves a few percent.
const WAVES: [periodMs: number, amp: number][] = [
  [7 * MIN, 0.006],
  [13 * MIN, 0.011],
  [29 * MIN, 0.017],
  [61 * MIN, 0.024],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function simMultiplier(symbol: string, t: number): number {
  let m = 1;
  WAVES.forEach(([period, amp], k) => {
    const phase = hash(`${symbol}:${k}`) * Math.PI * 2;
    const scale = 0.6 + hash(`${symbol}:amp:${k}`) * 0.8;
    m += amp * scale * Math.sin((2 * Math.PI * t) / period + phase);
  });
  return m;
}

export function simPrice(symbol: string, base: number, t: number): number {
  return base * simMultiplier(symbol, t);
}
