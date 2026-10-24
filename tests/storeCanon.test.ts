import { describe, it, expect } from 'vitest';
import { computeStoreCanon, deriveStoreName, type StoreObservation } from '../src/lib/reporting/storeCanon';

// Helper: make n observations for one (number, label).
function rows(n: number, storeNumber: string, hdStore: string): StoreObservation[] {
  return Array.from({ length: n }, () => ({ storeNumber, hdStore }));
}

describe('deriveStoreName', () => {
  it('strips the store number and title-cases the name', () => {
    expect(deriveStoreName('BARRIE - 7024')).toBe('Barrie');
    expect(deriveStoreName('ORILLIA - 7137')).toBe('Orillia');
    expect(deriveStoreName('7264 - ORILLIA')).toBe('Orillia');
    expect(deriveStoreName('   ')).toBe('');
  });
});

describe('computeStoreCanon — rolling mistyped store numbers into the real store', () => {
  it('folds a one-off number typo into the real store of the same name', () => {
    const obs = [
      ...rows(100, '7137', 'ORILLIA - 7137'),
      ...rows(1, '7124', 'ORILLIA - 7124'), // the real typo from 2025
      ...rows(1, '7127', 'ORILLIA - 7127'),
    ];
    const canon = computeStoreCanon(obs, []);
    expect(canon.canonical('7124', 'ORILLIA - 7124')).toBe('7137');
    expect(canon.canonical('7127', 'ORILLIA - 7127')).toBe('7137');
    expect(canon.canonical('7137', 'ORILLIA - 7137')).toBe('7137');
    expect(canon.mergedInto.get('7137')).toEqual(['7124', '7127']);
    expect(canon.labelFor('7137')).toBe('7137 — Orillia (incl. 7124, 7127)');
  });

  it('keeps a store together under the right number when only the NAME is mistyped', () => {
    const obs = [
      ...rows(90, '7024', 'BARRIE - 7024'),
      ...rows(1, '7024', 'BARRE - 7024'), // name typo, number correct
    ];
    const canon = computeStoreCanon(obs, []);
    // Same number throughout → one store, no phantom, no merge.
    expect(canon.canonical('7024', 'BARRE - 7024')).toBe('7024');
    expect(canon.mergedInto.has('7024')).toBe(false);
    expect(canon.nameFor('7024')).toBe('Barrie'); // the dominant name wins
  });

  it('does NOT bridge two real stores when one row is typed with the wrong store number', () => {
    // 7264 is really Bradford (lots of deals). A single row typed "7264 - ORILLIA"
    // must NOT drag Bradford into Orillia, nor Orillia into Bradford.
    const obs = [
      ...rows(100, '7137', 'ORILLIA - 7137'),
      ...rows(80, '7264', 'BRADFORD - 7264'),
      ...rows(1, '7264', '7264 - ORILLIA'), // the stray mislabel
    ];
    const canon = computeStoreCanon(obs, []);
    expect(canon.canonical('7137', 'ORILLIA - 7137')).toBe('7137');
    expect(canon.canonical('7264', 'BRADFORD - 7264')).toBe('7264'); // stays Bradford
    expect(canon.nameFor('7264')).toBe('Bradford');
    expect(canon.mergedInto.has('7137')).toBe(false); // Bradford not folded into Orillia
    expect(canon.mergedInto.has('7264')).toBe(false);
  });

  it('treats a configured store as authoritative — it is never folded away', () => {
    // Even if a same-name number carries more deals, a CONFIGURED number anchors
    // its own identity.
    const obs = [
      ...rows(5, '7137', 'ORILLIA - 7137'),
      ...rows(2, '7124', 'ORILLIA - 7124'),
    ];
    const canon = computeStoreCanon(obs, [{ number: '7137', name: 'Orillia' }]);
    expect(canon.canonical('7137')).toBe('7137');
    expect(canon.canonical('7124', 'ORILLIA - 7124')).toBe('7137'); // stray still rolls in
    expect(canon.nameFor('7137')).toBe('Orillia');
  });

  it('prefers the configured name for the label', () => {
    const canon = computeStoreCanon(rows(3, '7024', 'barrie-7024'), [{ number: '7024', name: 'Barrie South' }]);
    expect(canon.nameFor('7024')).toBe('Barrie South');
  });

  it('returns null for a blank store number and leaves a genuinely unknown store alone', () => {
    const canon = computeStoreCanon(rows(4, '7999', 'SOMEPLACE NEW - 7999'), []);
    expect(canon.canonical(null)).toBeNull();
    expect(canon.canonical('', 'x')).toBeNull();
    expect(canon.canonical('7999', 'SOMEPLACE NEW - 7999')).toBe('7999');
    expect(canon.canonical('8888', 'UNSEEN - 8888')).toBe('8888'); // unseen, no name match → kept
  });
});
