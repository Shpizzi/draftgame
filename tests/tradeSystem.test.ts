import { describe, it, expect } from 'vitest';
import { acceptanceProb, boostedProb } from '@/engine/tradeSystem';

describe('trade acceptance curve', () => {
  it('gap <= 0 → ~99% (offer at or above target)', () => {
    expect(acceptanceProb(50, 50)).toBeCloseTo(0.99, 5);
    expect(acceptanceProb(60, 50)).toBeCloseTo(0.99, 5);
  });

  it('anchor: offer 45, target 50 (gap 5) → ~30%', () => {
    expect(acceptanceProb(45, 50)).toBeCloseTo(0.3, 2);
  });

  it('smaller positive gaps → higher acceptance, larger gaps → lower', () => {
    const gap2 = acceptanceProb(48, 50); // gap 2
    const gap5 = acceptanceProb(45, 50); // gap 5
    const gap10 = acceptanceProb(40, 50); // gap 10
    expect(gap2).toBeGreaterThan(gap5);
    expect(gap5).toBeGreaterThan(gap10);
  });

  it('stays within clamp bounds', () => {
    expect(acceptanceProb(0, 100)).toBeGreaterThanOrEqual(0.01); // huge gap
    expect(acceptanceProb(49.9, 50)).toBeLessThanOrEqual(0.95); // tiny gap, capped
  });
});

describe('higher-probability power-up (boostedProb)', () => {
  it('boost=false is an exact pass-through', () => {
    const p = acceptanceProb(40, 50);
    expect(boostedProb(p, false)).toBe(p);
  });

  it('lifts a long-shot trade (and harder for low prob)', () => {
    const p = acceptanceProb(40, 50); // ~17%
    const boosted = boostedProb(p, true);
    expect(boosted).toBeGreaterThan(p);
    // boosted = p + BONUS*(1-p) — a 0.15 bonus turns ~0.17 into ~0.29
    expect(boosted).toBeCloseTo(p + 0.15 * (1 - p), 5);
  });

  it('never drags a favorable swap down (the 99% case stays ≥99%)', () => {
    const even = acceptanceProb(50, 50); // 0.99, above TRADE.MAX
    expect(boostedProb(even, true)).toBeGreaterThanOrEqual(even);
    expect(boostedProb(even, true)).toBeLessThanOrEqual(1);
  });
});
