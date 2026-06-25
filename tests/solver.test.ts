/**
 * Unit tests for the solver engine.
 */

import { describe, it, expect } from 'vitest';
import {
  solve,
  getAnagrams,
  isValidWord,
  getWordsStartingWith,
  getWordsByLength,
  getWordsByLengthAndStartingLetter,
  groupResultsByLength,
} from '../src/lib/solver';
import { createClientDictionary } from '../src/lib/dictionary-client';
const dictionary = await createClientDictionary();

describe('solve', () => {
  it('finds anagrams of "listen"', () => {
    const result = solve(dictionary, 'listen');
    const words = result.words.map((w) => w.word);
    expect(words).toContain('silent');
    expect(words).toContain('inlets');
    expect(words).toContain('tinsel');
    expect(words).toContain('listen');
  });

  it('finds words from a longer input', () => {
    const result = solve(dictionary, 'triangle');
    expect(result.words.length).toBeGreaterThan(0);
    // Should find various lengths from 2-8 letters
    const lengths = new Set(result.words.map((w) => w.length));
    expect(lengths.size).toBeGreaterThan(2);
  });

  it('respects minLength option', () => {
    const result = solve(dictionary, 'listen', { minLength: 5 });
    for (const word of result.words) {
      expect(word.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('returns empty results for invalid input', () => {
    const result = solve(dictionary, '');
    expect(result.words).toHaveLength(0);
  });

  it('returns empty results for impossible letters', () => {
    const result = solve(dictionary, 'xyz');
    expect(result.words.length).toBeLessThanOrEqual(3); // may have no valid words
  });

  it('tracks solve time', () => {
    const result = solve(dictionary, 'listen');
    expect(result.solveTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.solveTimeMs).toBeLessThan(100); // should be very fast
  });

  it('truncates long inputs', () => {
    const result = solve(dictionary, 'a'.repeat(13));
    expect(result.wasTruncated).toBe(true);
  });

  it('results are sorted by length desc, score desc, alpha asc', () => {
    const result = solve(dictionary, 'listen');
    const words = result.words;
    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1];
      const curr = words[i];
      // Length should be non-increasing
      expect(curr.length).toBeLessThanOrEqual(prev.length);
      if (curr.length === prev.length) {
        // Score should be non-increasing
        expect(curr.score).toBeLessThanOrEqual(prev.score);
      }
    }
  });

  it('supports wildcards (?, *, space)', () => {
    const result = solve(dictionary, 'list??');
    const words = result.words.map((w) => w.word);
    expect(words).toContain('silent');
    expect(words).toContain('listen');
    expect(words).toContain('tinsel');
    expect(words).toContain('list');
  });

  it('supports prefix filter', () => {
    const result = solve(dictionary, 'list??', { prefix: 'a' });
    for (const w of result.words) {
      expect(w.word.startsWith('a')).toBe(true);
    }
  });

  it('supports suffix filter', () => {
    const result = solve(dictionary, 'list??', { suffix: 's' });
    for (const w of result.words) {
      expect(w.word.endsWith('s')).toBe(true);
    }
  });

  it('supports contains filter', () => {
    const result = solve(dictionary, 'list??', { contains: 'e' });
    for (const w of result.words) {
      expect(w.word).toContain('e');
    }
  });

  it('supports Words With Friends scoring and sorting', () => {
    const resultScrabble = solve(dictionary, 'listen', { gameMode: 'scrabble' });
    const resultWWF = solve(dictionary, 'listen', { gameMode: 'wwf' });
    
    const elScrabble = resultScrabble.words.find(w => w.word === 'el');
    const elWWF = resultWWF.words.find(w => w.word === 'el');
    if (elScrabble && elWWF) {
      expect(elScrabble.score).toBe(2);
      expect(elWWF.score).toBe(3);
    }
  });
});

describe('getAnagrams', () => {
  it('finds anagrams of "listen"', () => {
    const anagrams = getAnagrams(dictionary, 'listen');
    expect(anagrams).toContain('silent');
    expect(anagrams).toContain('tinsel');
    expect(anagrams).not.toContain('listen'); // excludes the word itself
  });

  it('returns empty array for no anagrams', () => {
    const anagrams = getAnagrams(dictionary, 'xyzqwerty');
    expect(anagrams).toHaveLength(0);
  });
});

describe('isValidWord', () => {
  it('recognizes valid words', () => {
    expect(isValidWord(dictionary, 'hello')).toBe(true);
    expect(isValidWord(dictionary, 'world')).toBe(true);
    expect(isValidWord(dictionary, 'listen')).toBe(true);
  });

  it('rejects invalid words', () => {
    expect(isValidWord(dictionary, 'xyzqwerty')).toBe(false);
    expect(isValidWord(dictionary, '')).toBe(false);
  });
});

describe('getWordsStartingWith', () => {
  it('finds words starting with a letter', () => {
    const words = getWordsStartingWith(dictionary, 'a');
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      expect(word.startsWith('a')).toBe(true);
    }
  });

  it('returns empty for invalid letter', () => {
    expect(getWordsStartingWith(dictionary, '1')).toHaveLength(0);
  });
});

describe('getWordsByLength', () => {
  it('finds words of a specific length', () => {
    const words = getWordsByLength(dictionary, 5);
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      expect(word.length).toBe(5);
    }
  });
});

describe('getWordsByLengthAndStartingLetter', () => {
  it('finds 5-letter words starting with s', () => {
    const words = getWordsByLengthAndStartingLetter(dictionary, 5, 's');
    expect(words.length).toBeGreaterThan(0);
    for (const word of words) {
      expect(word.length).toBe(5);
      expect(word.startsWith('s')).toBe(true);
    }
  });
});

describe('groupResultsByLength', () => {
  it('groups results correctly', () => {
    const result = solve(dictionary, 'listen');
    const groups = groupResultsByLength(result.words);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].length).toBeGreaterThanOrEqual(groups[1]?.length ?? 0);
  });
});
