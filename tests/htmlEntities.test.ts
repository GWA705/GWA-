import { describe, it, expect } from 'vitest';
import { decodeEntities } from '@/lib/htmlEntities';

describe('decodeEntities (clean up Gmail snippet text)', () => {
  it('decodes the common named + numeric entities', () => {
    expect(decodeEntities('Hi Sean &amp; JJ')).toBe('Hi Sean & JJ');
    expect(decodeEntities('you&#39;re')).toBe("you're");
    expect(decodeEntities('she&#39;s &quot;upset&quot;')).toBe('she\'s "upset"');
    expect(decodeEntities('a &lt; b &gt; c')).toBe('a < b > c');
    expect(decodeEntities('x&#x27;y')).toBe("x'y");
  });

  it('leaves plain text and unknown entities untouched', () => {
    expect(decodeEntities('no entities here')).toBe('no entities here');
    expect(decodeEntities('A&B&C')).toBe('A&B&C');
    expect(decodeEntities('')).toBe('');
    expect(decodeEntities(null)).toBe('');
  });
});
