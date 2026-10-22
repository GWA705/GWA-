import { describe, it, expect } from 'vitest';
import { rowOverrideApplies } from '../src/lib/customerOverride';

/**
 * A journal-row contact override is keyed by position (year|tab|row). Rows shift,
 * so the same position can later hold a different customer — these lock that a row
 * override only overlays when its saved name still matches the row, so one
 * customer's correction (e.g. Marie Fossheim) can never paste onto another
 * (e.g. Satwinder Chana).
 */
describe('rowOverrideApplies', () => {
  it('applies when the saved name matches the row (case/space-insensitive)', () => {
    expect(rowOverrideApplies({ customerName: 'Satwinder Chana' }, 'SATWINDER CHANA')).toBe(true);
    expect(rowOverrideApplies({ customerName: '  satwinder   chana ' }, 'Satwinder Chana')).toBe(true);
  });

  it('does NOT apply when the saved name is a different customer (the crossing bug)', () => {
    expect(rowOverrideApplies({ customerName: 'Marie Fossheim' }, 'Satwinder Chana')).toBe(false);
  });

  it('does NOT apply when there is no saved name to verify against', () => {
    expect(rowOverrideApplies({ customerName: null }, 'Satwinder Chana')).toBe(false);
    expect(rowOverrideApplies({ customerName: '' }, 'Satwinder Chana')).toBe(false);
  });
});
