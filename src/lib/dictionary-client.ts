/**
 * Client-side dictionary loader.
 * Imports the compact JSON dictionary and wraps it in the Dictionary interface.
 * Scores are calculated on the fly to minimize bundle size.
 */

import type { Dictionary, WordEntry } from '../types/index.ts';
import clientData from './dictionary-client.json';
import { calculateScrabbleScore } from './scrabble.ts';

interface ClientDictionaryData {
  index: Record<string, string[]>;
  totalWords: number;
}

const data = clientData as unknown as ClientDictionaryData;

function createWordEntry(word: string): WordEntry {
  return {
    word,
    score: calculateScrabbleScore(word),
    length: word.length,
  };
}

/**
 * Create a Dictionary instance from the client JSON data.
 */
export function createClientDictionary(): Dictionary {
  const index = new Map<string, readonly WordEntry[]>();

  for (const [signature, words] of Object.entries(data.index)) {
    const entries: WordEntry[] = words.map(createWordEntry);
    index.set(signature, Object.freeze(entries));
  }

  return Object.freeze({
    index: Object.freeze(index),
    totalWords: data.totalWords,
    maxWordLength: 8,
  });
}

/** Singleton client dictionary instance */
export const clientDictionary = createClientDictionary();
