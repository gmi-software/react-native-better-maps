/**
 * Deterministic pseudo-random numbers for fixture generation.
 *
 * Every fixture in the lab is generated from an explicit seed through this
 * module and never from `Math.random()`, so the same scenario produces the
 * same data on every device and every run. `mulberry32` is a small 32-bit
 * generator with good statistical behaviour for this purpose; `splitmix32`
 * turns an arbitrary seed into a well-distributed starting state.
 */

export type RandomSource = () => number;

export function splitmix32(seed: number): number {
  let state = seed >>> 0;
  state = (state + 0x9e3779b9) >>> 0;
  let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

/** Returns a generator of floats in [0, 1) seeded deterministically. */
export function mulberry32(seed: number): RandomSource {
  let a = splitmix32(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience wrapper around a seeded source. */
export class Random {
  private readonly source: RandomSource;

  constructor(seed: number) {
    this.source = mulberry32(seed);
  }

  /** Float in [0, 1). */
  next(): number {
    return this.source();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.source() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.source() * (max - min + 1));
  }

  /** Standard normal deviate (Box–Muller). */
  gaussian(): number {
    const u = Math.max(this.source(), 1e-12);
    const v = this.source();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.source() * items.length)];
  }

  /** Deterministic partial Fisher–Yates: `count` distinct indices in [0, n). */
  indices(n: number, count: number): number[] {
    const wanted = Math.min(count, n);
    const pool = new Uint32Array(n);
    for (let index = 0; index < n; index += 1) {
      pool[index] = index;
    }
    const picked: number[] = [];
    for (let index = 0; index < wanted; index += 1) {
      const swap = index + Math.floor(this.source() * (n - index));
      const value = pool[swap];
      pool[swap] = pool[index];
      pool[index] = value;
      picked.push(value);
    }
    return picked.sort((a, b) => a - b);
  }
}

/** Rounds to a fixed number of decimals so JSON output is byte-stable. */
export function round(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
