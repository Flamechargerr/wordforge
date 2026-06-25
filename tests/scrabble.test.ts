/**
 * Unit tests for Scrabble utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateScrabbleScore,
  getSignature,
  getLetterCounts,
  canFormWord,
  normalizeInput,
  validateInput,
  getLongestWord,
  getHighestScoringWord,
  groupByLength,
} from '../src/lib/scrabble';

describe('calculateScrabbleScore', () => {
  it('scores basic words correctly', () => {
    expect(calculateScrabbleScore('a')).toBe(1);
    expect(calculateScrabbleScore('cat')).toBe(5); // c(3) + a(1) + t(1)
    expect(calculateScrabbleScore('quiz')).toBe(22); // q(10) + u(1) + i(1) + z(10)
  });

  it('is case insensitive', () => {
    expect(calculateScrabbleScore('HELLO')).toBe(calculateScrabbleScore('hello'));
  });

  it('returns 0 for empty input', () => {
    expect(calculateScrabbleScore('')).toBe(0);
  });
});

describe('getSignature', () => {
  it('sorts letters alphabetically', () => {
    expect(getSignature('listen')).toBe('eilnst');
    expect(getSignature('silent')).toBe('eilnst');
    expect(getSignature('triangle')).toBe('aegilnrt');
  });

  it('is case insensitive', () => {
    expect(getSignature('LISTEN')).toBe('eilnst');
  });
});

describe('getLetterCounts', () => {
  it('counts letters correctly', () => {
    const counts = getLetterCounts('hello');
    expect(counts.get('h')).toBe(1);
    expect(counts.get('e')).toBe(1);
    expect(counts.get('l')).toBe(2);
    expect(counts.get('o')).toBe(1);
  });
});

describe('canFormWord', () => {
  it('returns true when word can be formed', () => {
    const available = getLetterCounts('listen');
    expect(canFormWord('silent', available)).toBe(true);
    expect(canFormWord('list', available)).toBe(true);
  });

  it('returns false when letters are insufficient', () => {
    const available = getLetterCounts('listen');
    expect(canFormWord('letter', available)).toBe(false); // needs two 't's
  });
});

describe('normalizeInput', () => {
  it('lowercases and removes non-letters', () => {
    expect(normalizeInput('HeLLo!')).toBe('hello');
    expect(normalizeInput('a-b-c')).toBe('abc');
    expect(normalizeInput('123abc')).toBe('abc');
  });
});

describe('validateInput', () => {
  it('validates minimum length', () => {
    expect(validateInput('a').valid).toBe(false);
    expect(validateInput('ab').valid).toBe(true);
  });

  it('validates maximum length', () => {
    expect(validateInput('a'.repeat(16)).valid).toBe(false);
  });

  it('rejects empty input', () => {
    expect(validateInput('').valid).toBe(false);
  });
});

describe('getLongestWord', () => {
  it('finds the longest word', () => {
    const words = [
      { word: 'cat', length: 3 },
      { word: 'elephant', length: 8 },
      { word: 'dog', length: 3 },
    ];
    expect(getLongestWord(words)?.word).toBe('elephant');
  });

  it('returns undefined for empty array', () => {
    expect(getLongestWord([])).toBeUndefined();
  });
});

describe('getHighestScoringWord', () => {
  it('finds the highest scoring word', () => {
    const words = [
      { word: 'cat', score: 5 },
      { word: 'quiz', score: 22 },
      { word: 'dog', score: 5 },
    ];
    expect(getHighestScoringWord(words)?.word).toBe('quiz');
  });
});

describe('groupByLength', () => {
  it('groups words by length', () => {
    const words = [
      { word: 'a', score: 1, length: 1 },
      { word: 'at', score: 2, length: 2 },
      { word: 'cat', score: 5, length: 3 },
      { word: 'bat', score: 5, length: 3 },
    ];
    const groups = groupByLength(words);
    expect(groups).toHaveLength(3);
    expect(groups[0].length).toBe(3); // longest first
    expect(groups[0].words).toHaveLength(2);
  });
});
