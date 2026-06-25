import * as fs from 'node:fs';
import * as path from 'node:path';

let dictCache: Record<string, any> | null = null;

function loadDict(): Record<string, any> {
  if (!dictCache) {
    // Resolve path relative to process.cwd() since Astro runs at project root
    const dictPath = path.resolve(process.cwd(), 'data/dictionary.json');
    try {
      dictCache = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    } catch (e) {
      console.error('Failed to load dictionary.json:', e);
      dictCache = {};
    }
  }
  return dictCache;
}

export interface WordMeaning {
  partOfSpeech: string;
  definition: string;
  synonyms: string[];
  examples: string[];
}

export interface WordDefinition {
  word: string;
  meanings: WordMeaning[];
  synonyms: string[];
  antonyms: string[];
}

/**
 * Look up the definition of a word.
 * If not found, attempts stem/root word fallbacks (e.g. "runs" -> "run").
 */
export function getWordDefinition(word: string): WordDefinition | null {
  const dict = loadDict();
  const upper = word.toUpperCase();
  
  // 1. Exact match
  if (dict[upper]) {
    return formatEntry(upper, dict[upper]);
  }
  
  // 2. Try common stems
  const stems = [
    upper.endsWith('S') && !upper.endsWith('SS') ? upper.slice(0, -1) : null,
    upper.endsWith('ES') ? upper.slice(0, -2) : null,
    upper.endsWith('ED') ? upper.slice(0, -1) : null, // loved -> love
    upper.endsWith('ED') ? upper.slice(0, -2) : null, // played -> play
    upper.endsWith('ING') ? upper.slice(0, -3) : null, // playing -> play
    upper.endsWith('ING') ? upper.slice(0, -3) + 'E' : null, // loving -> love
    upper.endsWith('LY') ? upper.slice(0, -2) : null, // quickly -> quick
    upper.startsWith('UN') ? upper.slice(2) : null,
    upper.startsWith('RE') ? upper.slice(2) : null,
  ].filter((s): s is string => !!s && s.length > 2);
  
  for (const stem of stems) {
    if (dict[stem]) {
      return formatEntry(stem, dict[stem]);
    }
  }
  
  return null;
}

function formatEntry(word: string, entry: any): WordDefinition {
  const meanings: WordMeaning[] = (entry.MEANINGS || []).map((m: any) => ({
    partOfSpeech: m[0] || '',
    definition: m[1] || '',
    synonyms: m[2] || [],
    examples: m[3] || []
  }));
  
  return {
    word: word.toLowerCase(),
    meanings,
    synonyms: entry.SYNONYMS || [],
    antonyms: entry.ANTONYMS || []
  };
}
