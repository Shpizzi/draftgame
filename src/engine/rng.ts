// Seedable PRNG. The WHOLE run threads a single Rng instance so the engine is
// deterministic given a seed — required for tests and the future replay/integrity path.
// Never use Math.random inside the engine.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Standard-normal sample (Box–Muller), scaled by sigma and shifted by mean. */
  gaussian(mean?: number, sigma?: number): number;
  /** Returns true with the given probability. */
  chance(p: number): boolean;
}

// Hash a string seed into a 32-bit integer (xmur3) so any string can seed the run.
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

// mulberry32: small, fast, good-enough statistical quality for a game.
export function createRng(seed: string): Rng {
  let a = xmur3(seed);
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spareGaussian: number | null = null;

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    gaussian(mean = 0, sigma = 1) {
      if (spareGaussian !== null) {
        const z = spareGaussian;
        spareGaussian = null;
        return mean + sigma * z;
      }
      // Box–Muller
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const mag = Math.sqrt(-2 * Math.log(u));
      const z0 = mag * Math.cos(2 * Math.PI * v);
      const z1 = mag * Math.sin(2 * Math.PI * v);
      spareGaussian = z1;
      return mean + sigma * z0;
    },
  };
}

/** Generate a random-ish seed string for a fresh run (UI only, never inside the engine). */
export function freshSeed(): string {
  return (
    Date.now().toString(36) +
    Math.floor(Math.random() * 1e9).toString(36)
  );
}
