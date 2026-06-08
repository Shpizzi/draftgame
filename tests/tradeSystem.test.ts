import { describe, it, expect } from 'vitest';
import { acceptanceProb } from '@/engine/tradeSystem';

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
