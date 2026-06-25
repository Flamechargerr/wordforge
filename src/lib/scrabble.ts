/**
 * Pure utility functions for Scrabble scoring and word manipulation.
 * No side effects, no framework dependencies.
 */

import { SCRABBLE_TILE_VALUES } from '../types/index.ts';

/**
 * Calculate the Scrabble score for a word.
 * @param word - The word to score (case-insensitive)
 * @returns The total tile score, or 0 for empty/invalid input
 */
export function calculateScrabbleScore(word: string): number {
  if (!word || word.length === 0) return 0;

  let score = 0;
  for (const ch of word.toLowerCase()) {
    score += SCRABBLE_TILE_VALUES[ch] ?? 0;
  }
  return score;
}

/**
 * Generate the sorted signature of a word (letters sorted alphabetically).
 * This is the core of the anagram index.
 * @param word - The word to signature (case-insensitive)
 * @returns The sorted letter signature, e.g., "listen" -> "eilnst"
 */
export function getSignature(word: string): string {
  return word.toLowerCase().split('').sort().join('');
}

/**
 * Count occurrences of each letter in a word.
 * @param word - The word to analyze
 * @returns A Map of letter -> count
 */
export function getLetterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of word.toLowerCase()) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

/**
 * Check if a word can be formed from the available letter counts.
 * @param word - The word to check
 * @param available - Available letter counts
 * @returns True if the word can be formed
 */
export function canFormWord(word: string, available: Map<string, number>): boolean {
  const wordCounts = getLetterCounts(word);
  for (const [ch, count] of wordCounts.entries()) {
    if ((available.get(ch) ?? 0) < count) {
      return false;
    }
  }
  return true;
}

/**
 * Normalize input letters: lowercase, remove non-alphabetic characters.
 * @param input - Raw user input
 * @returns Cleaned letters
 */
export function normalizeInput(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Validate that input is suitable for solving.
 * @param input - Normalized input
 * @returns Validation result
 */
export function validateInput(input: string): { valid: boolean; error?: string } {
  if (!input || input.length === 0) {
    return { valid: false, error: 'Please enter some letters' };
  }
  if (input.length < 2) {
    return { valid: false, error: 'Enter at least 2 letters' };
  }
  if (input.length > 15) {
    return { valid: false, error: 'Maximum 15 letters allowed' };
  }
  return { valid: true };
}

/**
 * Get the longest word from a list of results.
 * @param words - Array of word entries
 * @returns The longest word entry, or undefined if empty
 */
export function getLongestWord(words: readonly { word: string; length: number }[]):
  | { word: string; length: number }
  | undefined {
  if (words.length === 0) return undefined;
  return words.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
}

/**
 * Get the highest-scoring word from a list of results.
 * @param words - Array of word entries
 * @returns The highest-scoring word entry, or undefined if empty
 */
export function getHighestScoringWord(
  words: readonly { word: string; score: number }[]
): { word: string; score: number } | undefined {
  if (words.length === 0) return undefined;
  return words.reduce((best, current) => (current.score > best.score ? current : best));
}

/**
 * Group words by their length.
 * @param words - Array of word entries
 * @returns Array of groups, sorted by length descending
 */
export function groupByLength(
  words: readonly { word: string; score: number; length: number }[]
): { length: number; words: { word: string; score: number; length: number }[] }[] {
  const groups = new Map<number, { word: string; score: number; length: number }[]>();

  for (const word of words) {
    const existing = groups.get(word.length) ?? [];
    existing.push(word);
    groups.set(word.length, existing);
  }

  return Array.from(groups.entries())
    .map(([length, words]) => ({ length, words }))
    .sort((a, b) => b.length - a.length);
}
