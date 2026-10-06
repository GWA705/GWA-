import { describe, it, expect } from 'vitest';
import { diffRouting, describeChange, type RoutingRow } from '../src/lib/storeRoutingDiff';

const r = (number: string, dealerName: string, city = '', active = true): RoutingRow => ({ number, dealerName, city, active });

describe('diffRouting', () => {
  it('detects a move (store reassigned to a different office)', () => {
    const db = [r('7030', 'Georgian Water and Air', 'Newmarket')];
    const sheet = [r('7030', 'Swift', 'Newmarket')];
    const changes = diffRouting(db, sheet);
    expect(changes).toEqual([{ kind: 'move', number: '7030', city: 'Newmarket', from: 'Georgian Water and Air', to: 'Swift' }]);
  });

  it('ignores office name case/whitespace differences', () => {
    const db = [r('7030', 'Swift', 'Newmarket')];
    const sheet = [r('7030', '  swift ', 'Newmarket')];
    expect(diffRouting(db, sheet)).toEqual([]);
  });

  it('adds a store that is in the sheet but not the portal', () => {
    const changes = diffRouting([], [r('7099', 'Swift', 'Testville')]);
    expect(changes).toEqual([{ kind: 'add', number: '7099', city: 'Testville', to: 'Swift' }]);
  });

  it('deactivates a store that is active in the portal but gone from the sheet (reversible)', () => {
    const db = [r('7030', 'Swift', 'Newmarket', true)];
    const changes = diffRouting(db, []);
    expect(changes).toEqual([{ kind: 'deactivate', number: '7030', dealerName: 'Swift', reason: 'missing' }]);
  });

  it('activates / deactivates on the Active flag', () => {
    expect(diffRouting([r('7030', 'Swift', '', false)], [r('7030', 'Swift', '', true)]))
      .toEqual([{ kind: 'activate', number: '7030', dealerName: 'Swift' }]);
    expect(diffRouting([r('7030', 'Swift', '', true)], [r('7030', 'Swift', '', false)]))
      .toEqual([{ kind: 'deactivate', number: '7030', dealerName: 'Swift', reason: 'sheet' }]);
  });

  it('skips sheet rows with no office (incomplete rows never reroute)', () => {
    expect(diffRouting([r('7030', 'Swift')], [r('7030', '')])).toEqual([
      // 7030 absent from the usable sheet set → treated as dropped → deactivate
      { kind: 'deactivate', number: '7030', dealerName: 'Swift', reason: 'missing' },
    ]);
  });

  it('is empty when the sheet matches the portal', () => {
    const rows = [r('7024', 'Georgian Water and Air', 'Barrie'), r('7030', 'Swift', 'Newmarket')];
    expect(diffRouting(rows, [...rows])).toEqual([]);
  });

  it('describes a move in plain language', () => {
    expect(describeChange({ kind: 'move', number: '7030', city: 'Newmarket', from: 'Georgian Water and Air', to: 'Swift' }))
      .toBe('Store 7030 (Newmarket): Georgian Water and Air → Swift');
  });
});
