/**
 * Client-side dictionary loader.
 * Imports the compact JSON dictionary and wraps it in the Dictionary interface.
 * Scores are calculated on the fly to minimize bundle size.
 */

import type { Dictionary, WordEntry } from '../types/index.ts';
import { calculateScrabbleScore } from './scrabble.ts';

interface ClientDictionaryData {
  index: Record<string, string[]>;
  totalWords: number;
}

let cachedDict: Dictionary | null = null;

function createWordEntry(word: string): WordEntry {
  return {
    word,
    score: calculateScrabbleScore(word),
    length: word.length,
  };
}

/**
 * Create a Dictionary instance from the client JSON data asynchronously.
 */
export async function createClientDictionary(): Promise<Dictionary> {
  if (cachedDict) return cachedDict;

  const clientData = await import('./dictionary-client.json');
  const data = clientData.default as unknown as ClientDictionaryData;

  const index = new Map<string, readonly WordEntry[]>();
  let maxLen = 0;

  for (const [signature, words] of Object.entries(data.index)) {
    const entries: WordEntry[] = words.map(createWordEntry);
    index.set(signature, Object.freeze(entries));
    for (const entry of entries) {
      if (entry.length > maxLen) maxLen = entry.length;
    }
  }

  cachedDict = Object.freeze({
    index: Object.freeze(index),
    totalWords: data.totalWords,
    maxWordLength: maxLen,
  });

  return cachedDict;
}
