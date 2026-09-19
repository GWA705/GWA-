import { describe, it, expect } from 'vitest';
import { priceUsd, MODEL_RATES } from '@/lib/aiUsage';

describe('priceUsd', () => {
  it('prices Opus 5 at $5/$25 per million tokens', () => {
    // 1M input + 1M output = $5 + $25 = $30
    expect(priceUsd('claude-opus-5', 1_000_000, 1_000_000)).toBeCloseTo(30, 6);
  });

  it('prices Sonnet 5 at $2/$10 per million tokens', () => {
    expect(priceUsd('claude-sonnet-5', 1_000_000, 1_000_000)).toBeCloseTo(12, 6);
  });

  it('prices a realistic single card scan (~3k in, ~500 out) on Opus 5 in the cents range', () => {
    const cost = priceUsd('claude-opus-5', 3000, 500);
    // 3000/1e6*5 + 500/1e6*25 = 0.015 + 0.0125 = 0.0275
    expect(cost).toBeCloseTo(0.0275, 6);
  });

  it('falls back to Sonnet-tier pricing for an unknown model (never $0)', () => {
    expect('some-future-model' in MODEL_RATES).toBe(false);
    expect(priceUsd('some-future-model', 1_000_000, 0)).toBeCloseTo(2, 6);
  });

  it('is zero for zero tokens', () => {
    expect(priceUsd('claude-opus-5', 0, 0)).toBe(0);
  });
});
