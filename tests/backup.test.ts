import { describe, it, expect } from 'vitest';
import { backupReplacer, BACKUP_PREFIX } from '@/lib/backup';

describe('backupReplacer', () => {
  it('serializes BigInt values as strings (JSON.stringify would otherwise throw)', () => {
    const out = JSON.stringify({ n: 10n }, backupReplacer);
    expect(out).toBe('{"n":"10"}');
  });

  it('leaves ordinary values untouched', () => {
    const obj = { a: 1, b: 'x', c: true, d: null, e: [1, 2] };
    expect(JSON.parse(JSON.stringify(obj, backupReplacer))).toEqual(obj);
  });

  it('serializes Dates via their ISO form', () => {
    const d = new Date('2026-08-09T12:00:00.000Z');
    expect(JSON.stringify({ d }, backupReplacer)).toBe('{"d":"2026-08-09T12:00:00.000Z"}');
  });
});

describe('BACKUP_PREFIX', () => {
  it('is a folder-style prefix', () => {
    expect(BACKUP_PREFIX.endsWith('/')).toBe(true);
  });
});
