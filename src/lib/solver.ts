/**
 * Core solver engine for WordForge.
 * Pure TypeScript — no framework dependencies, no side effects.
 * Uses a sorted-key (signature) index for O(1) anagram lookups.
 */

import type { Dictionary, WordEntry, SolverOptions, SolverResult, WordGroup } from '../types/index.ts';
import {
  getLetterCounts,
  canFormWord,
  normalizeInput,
  validateInput,
  groupByLength,
  calculateWWFScore,
} from './scrabble.ts';

/** Maximum input length before truncation for performance */
const MAX_INPUT_LENGTH = 12;

/**
 * Solve: find all valid words that can be formed from the given letters.
 * @param dictionary - The pre-built dictionary index
 * @param input - Raw user input (letters)
 * @param options - Solver options
 * @returns Solver result with matched words and metadata
 */
export function solve(
  dictionary: Dictionary,
  input: string,
  options: SolverOptions = {}
): SolverResult {
  const startTime = performance.now();
  const normalized = normalizeInput(input);
  const validation = validateInput(normalized);

  if (!validation.valid) {
    return {
      words: [],
      input: normalized,
      solveTimeMs: performance.now() - startTime,
      wasTruncated: false,
    };
  }

  // Truncate very long inputs for performance
  const wasTruncated = normalized.length > MAX_INPUT_LENGTH;
  const effectiveInput = wasTruncated
    ? normalized.slice(0, MAX_INPUT_LENGTH)
    : normalized;

  // Extract wildcards
  let wildcardCount = 0;
  let normalLetters = '';
  for (const ch of effectiveInput) {
    if (ch === '?' || ch === '*' || ch === ' ') {
      wildcardCount++;
    } else {
      normalLetters += ch;
    }
  }

  const minLength = Math.max(2, options.minLength ?? 2);
  const maxLength = Math.min(
    options.maxLength ?? effectiveInput.length,
    effectiveInput.length
  );

  const results: WordEntry[] = [];
  const seen = new Set<string>();

  if (wildcardCount > 0) {
    // Wildcard solving algorithm: iterate over dictionary index
    const normalCounts = getLetterCounts(normalLetters);

    for (const [signature, entries] of dictionary.index.entries()) {
      if (signature.length < minLength || signature.length > maxLength) {
        continue;
      }

      // Check if signature can be formed with available normal letters + wildcards
      let requiredWildcards = 0;
      let possible = true;

      const sigCounts = getLetterCounts(signature);
      for (const [ch, count] of sigCounts.entries()) {
        const available = normalCounts.get(ch) ?? 0;
        if (count > available) {
          requiredWildcards += (count - available);
          if (requiredWildcards > wildcardCount) {
            possible = false;
            break;
          }
        }
      }

      if (possible) {
        for (const entry of entries) {
          if (!seen.has(entry.word)) {
            seen.add(entry.word);
            results.push(entry);
          }
        }
      }
    }
  } else {
    // Normal solving algorithm: bitmask subset lookup
    const inputCounts = getLetterCounts(effectiveInput);
    const chars = effectiveInput.split('').sort();
    const n = chars.length;

    for (let mask = 1; mask < 1 << n; mask++) {
      const subsetLength = countBits(mask);

      if (subsetLength < minLength || subsetLength > maxLength) {
        continue;
      }

      const subset: string[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          subset.push(chars[i]);
        }
      }

      const signature = subset.join('');
      const matches = dictionary.index.get(signature);

      if (matches) {
        for (const entry of matches) {
          if (!seen.has(entry.word) && canFormWord(entry.word, inputCounts)) {
            seen.add(entry.word);
            results.push(entry);
          }
        }
      }
    }
  }

  // Apply filters (prefix, suffix, contains)
  let filteredResults = results;

  if (options.prefix) {
    const prefix = options.prefix.toLowerCase();
    filteredResults = filteredResults.filter((e) => e.word.startsWith(prefix));
  }
  if (options.suffix) {
    const suffix = options.suffix.toLowerCase();
    filteredResults = filteredResults.filter((e) => e.word.endsWith(suffix));
  }
  if (options.contains) {
    const contains = options.contains.toLowerCase();
    filteredResults = filteredResults.filter((e) => e.word.includes(contains));
  }

  // Calculate dynamic scores if gameMode is wwf
  const mappedResults: WordEntry[] = options.gameMode === 'wwf'
    ? filteredResults.map((entry) => ({
        word: entry.word,
        score: calculateWWFScore(entry.word),
        length: entry.length,
      }))
    : filteredResults;

  // Sort by: length desc, score desc, alphabetical asc
  mappedResults.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    if (b.score !== a.score) return b.score - a.score;
    return a.word.localeCompare(b.word);
  });

  // Apply limit if specified
  const limitedResults = options.limit ? mappedResults.slice(0, options.limit) : mappedResults;

  return {
    words: limitedResults,
    input: normalized,
    solveTimeMs: performance.now() - startTime,
    wasTruncated,
  };
}

/**
 * Get all anagrams of a specific word (excluding the word itself).
 * @param dictionary - The dictionary
 * @param word - The word to find anagrams for
 * @returns Array of anagram words
 */
export function getAnagrams(dictionary: Dictionary, word: string): string[] {
  const normalized = normalizeInput(word);
  if (!normalized) return [];

  const signature = normalized.split('').sort().join('');
  const matches = dictionary.index.get(signature);

  if (!matches) return [];

  return matches
    .map((entry) => entry.word)
    .filter((w) => w !== normalized);
}

/**
 * Check if a word is valid (exists in the dictionary).
 * @param dictionary - The dictionary
 * @param word - The word to check
 * @returns True if valid
 */
export function isValidWord(dictionary: Dictionary, word: string): boolean {
  const normalized = normalizeInput(word);
  if (!normalized) return false;

  const signature = normalized.split('').sort().join('');
  const matches = dictionary.index.get(signature);

  if (!matches) return false;
  return matches.some((entry) => entry.word === normalized);
}

/**
 * Get words from the dictionary that start with a given letter.
 * @param dictionary - The dictionary
 * @param letter - Starting letter
 * @returns Array of words
 */
export function getWordsStartingWith(dictionary: Dictionary, letter: string): string[] {
  const lower = letter.toLowerCase();
  if (!/^[a-z]$/.test(lower)) return [];

  const results: string[] = [];
  for (const entries of dictionary.index.values()) {
    for (const entry of entries) {
      if (entry.word.startsWith(lower)) {
        results.push(entry.word);
      }
    }
  }
  return [...new Set(results)].sort();
}

/**
 * Get words from the dictionary by length.
 * @param dictionary - The dictionary
 * @param length - Word length
 * @returns Array of words
 */
export function getWordsByLength(dictionary: Dictionary, length: number): string[] {
  const results: string[] = [];
  for (const entries of dictionary.index.values()) {
    for (const entry of entries) {
      if (entry.length === length) {
        results.push(entry.word);
      }
    }
  }
  return [...new Set(results)].sort();
}

/**
 * Get words from the dictionary by length and starting letter.
 * @param dictionary - The dictionary
 * @param length - Word length
 * @param letter - Starting letter
 * @returns Array of words
 */
export function getWordsByLengthAndStartingLetter(
  dictionary: Dictionary,
  length: number,
  letter: string
): string[] {
  const lower = letter.toLowerCase();
  if (!/^[a-z]$/.test(lower)) return [];

  const results: string[] = [];
  for (const entries of dictionary.index.values()) {
    for (const entry of entries) {
      if (entry.length === length && entry.word.startsWith(lower)) {
        results.push(entry.word);
      }
    }
  }
  return [...new Set(results)].sort();
}

/**
 * Get words from the dictionary that end with a given suffix.
 * @param dictionary - The dictionary
 * @param suffix - Ending suffix (e.g., 'ing', 'tion', 'ed')
 * @returns Array of words ending with the suffix
 */
export function getWordsEndingWith(dictionary: Dictionary, suffix: string): string[] {
  const lower = suffix.toLowerCase();
  if (!lower || !/^[a-z]+$/.test(lower)) return [];

  const results: string[] = [];
  for (const entries of dictionary.index.values()) {
    for (const entry of entries) {
      if (entry.word.endsWith(lower) && entry.word.length > lower.length) {
        results.push(entry.word);
      }
    }
  }
  return [...new Set(results)].sort();
}

/**
 * Get words from the dictionary that contain a given letter.
 * @param dictionary - The dictionary
 * @param letter - The letter to search for
 * @returns Array of words containing the letter
 */
export function getWordsContaining(dictionary: Dictionary, letter: string): string[] {
  const lower = letter.toLowerCase();
  if (!/^[a-z]$/.test(lower)) return [];

  const results: string[] = [];
  for (const entries of dictionary.index.values()) {
    for (const entry of entries) {
      if (entry.word.includes(lower)) {
        results.push(entry.word);
      }
    }
  }
  return [...new Set(results)].sort();
}

/**
 * Group solver results by word length.
 * @param words - Solver result words
 * @returns Grouped words, sorted by length descending
 */
export function groupResultsByLength(words: readonly WordEntry[]): WordGroup[] {
  return groupByLength(words).map((group) => ({
    length: group.length,
    words: group.words,
  }));
}

/** Count the number of set bits in a bitmask (population count). */
function countBits(n: number): number {
  let count = 0;
  while (n) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}
