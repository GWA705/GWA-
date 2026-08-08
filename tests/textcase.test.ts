import { describe, it, expect } from 'vitest';
import { toTitleCase, toSentenceCase } from '@/lib/textcase';

describe('toTitleCase', () => {
  it('fixes ALL CAPS and all-lowercase to Title Case', () => {
    expect(toTitleCase('BAG FOR TREE SAMPLE KIT')).toBe('Bag for Tree Sample Kit');
    expect(toTitleCase('bag for tree sample kit')).toBe('Bag for Tree Sample Kit');
  });

  it('keeps domain acronyms uppercase', () => {
    expect(toTitleCase('HD envelope for water test kits')).toBe('HD Envelope for Water Test Kits');
    expect(toTitleCase('pap form on file')).toBe('PAP Form on File');
  });

  it('preserves province codes typed in caps', () => {
    expect(toTitleCase('Aerus NB')).toBe('Aerus NB');
    expect(toTitleCase('aerus pei')).toBe('Aerus PEI');
  });

  it('lowercases minor words only in the middle', () => {
    expect(toTitleCase('the water of life')).toBe('The Water of Life');
    expect(toTitleCase('for the win')).toBe('For the Win');
  });

  it('handles hyphenated words and extra spaces', () => {
    expect(toTitleCase('  in-store   test  ')).toBe('In-Store Test');
  });

  it('title-cases ordinary names', () => {
    expect(toTitleCase('john smith')).toBe('John Smith');
  });
});

describe('toSentenceCase', () => {
  it('cleans up ALL CAPS into sentence case', () => {
    expect(toSentenceCase('PLASTIC BAG USED TO HOLD TEST KIT. HAS A WHOLE HANG ON PEG TREE')).toBe(
      'Plastic bag used to hold test kit. Has a whole hang on peg tree',
    );
  });

  it('does not lowercase intentional proper nouns in mixed-case text', () => {
    expect(toSentenceCase('envelope for Home Depot test kits')).toBe('Envelope for Home Depot test kits');
  });

  it('capitalizes the first letter of each sentence', () => {
    expect(toSentenceCase('first thing. second thing')).toBe('First thing. Second thing');
  });

  it('keeps domain acronyms uppercase', () => {
    expect(toSentenceCase('give the customer their hd paperwork')).toBe('Give the customer their HD paperwork');
  });

  it('does not turn the word "on" into a province code', () => {
    expect(toSentenceCase('hang it on the peg')).toBe('Hang it on the peg');
  });

  it('preserves line breaks', () => {
    expect(toSentenceCase('line one\nline two')).toBe('Line one\nLine two');
  });
});
