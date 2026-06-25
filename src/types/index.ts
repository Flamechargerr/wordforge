/**
 * Core types for the WordForge dictionary and solver engine.
 * These types are framework-agnostic and used by both server-side
 * generation and client-side solving.
 */

export interface WordEntry {
  /** The canonical lowercase word */
  readonly word: string;
  /** Scrabble tile score */
  readonly score: number;
  /** Word length */
  readonly length: number;
}

export interface Dictionary {
  /** Sorted-key index: signature -> words with that signature */
  readonly index: ReadonlyMap<string, readonly WordEntry[]>;
  /** Total word count */
  readonly totalWords: number;
  /** Maximum word length in the dictionary */
  readonly maxWordLength: number;
}

export interface SolverOptions {
  /** Minimum word length to include (default: 2) */
  readonly minLength?: number;
  /** Maximum word length to include (default: input length) */
  readonly maxLength?: number;
  /** Maximum number of results to return (default: unlimited) */
  readonly limit?: number;
}

export interface SolverResult {
  /** All matched words, sorted by length desc, score desc, alphabetical */
  readonly words: readonly WordEntry[];
  /** Input letters that were searched */
  readonly input: string;
  /** Time taken to solve in milliseconds */
  readonly solveTimeMs: number;
  /** Whether the solve was truncated due to input length */
  readonly wasTruncated: boolean;
}

export interface WordGroup {
  /** Word length for this group */
  readonly length: number;
  /** Words of this length */
  readonly words: readonly WordEntry[];
}

export type SortMode = 'length' | 'score' | 'alpha';

/** Scrabble tile values for standard English */
export const SCRABBLE_TILE_VALUES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1,
  j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1,
  s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
};
