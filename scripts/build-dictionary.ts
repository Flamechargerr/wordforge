/**
 * Build script: generates compact dictionary modules for WordForge.
 * 
 * Strategy:
 * - Server dictionary: full index (all 359K words) for Astro SSG pages
 * - Client dictionary: subset of 50K most useful words, compact JSON format
 * 
 * Run: `npx tsx scripts/build-dictionary.ts`
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRABBLE_TILE_VALUES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1,
  j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1,
  s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
};

// Load validation data
const dictPath = path.join(__dirname, '../data/dictionary.json');
const commonWordsPath = path.join(__dirname, '../data/common-words.txt');

const dictData = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
const commonWords = new Set(
  fs.readFileSync(commonWordsPath, 'utf8')
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(Boolean)
);

function isDirectlyValid(word: string): boolean {
  if (commonWords.has(word)) return true;
  const upper = word.toUpperCase();
  const entry = dictData[upper];
  return !!(entry && entry.MEANINGS && entry.MEANINGS.length > 0);
}

function isValidEnglishWord(word: string): boolean {
  if (isDirectlyValid(word)) return true;
  if (word.length <= 2) {
    return isDirectlyValid(word);
  }

  // Prefix checks
  if (word.startsWith('un') && word.length > 4) {
    const stem = word.slice(2);
    if (isDirectlyValid(stem) || isValidEnglishWord(stem)) return true;
  }
  if (word.startsWith('re') && word.length > 4) {
    const stem = word.slice(2);
    if (isDirectlyValid(stem) || isValidEnglishWord(stem)) return true;
  }

  // Suffix checks
  if (word.endsWith('ly') && word.length > 4) {
    if (word.endsWith('ily')) {
      const stem = word.slice(0, -3) + 'y';
      if (isDirectlyValid(stem)) return true;
    }
    const stem = word.slice(0, -2);
    if (isDirectlyValid(stem) || isValidEnglishWord(stem)) return true;
  }

  if (word.endsWith('s') && !word.endsWith('ss')) {
    if (word.endsWith('ies') && word.length > 4) {
      const stem = word.slice(0, -3) + 'y';
      if (isDirectlyValid(stem)) return true;
    }
    if (word.endsWith('es') && word.length > 4) {
      const stem = word.slice(0, -2);
      if (isDirectlyValid(stem) || isDirectlyValid(word.slice(0, -1))) return true;
    }
    const stem = word.slice(0, -1);
    if (isDirectlyValid(stem)) return true;
  }

  if (word.endsWith('ed') && word.length > 4) {
    if (word.endsWith('ied')) {
      const stem = word.slice(0, -3) + 'y';
      if (isDirectlyValid(stem)) return true;
    }
    const stemD = word.slice(0, -1);
    if (isDirectlyValid(stemD)) return true;
    const stemEd = word.slice(0, -2);
    if (isDirectlyValid(stemEd)) return true;
    
    if (word.length > 5 && word.charAt(word.length - 3) === word.charAt(word.length - 4)) {
      const stemDouble = word.slice(0, -3);
      if (isDirectlyValid(stemDouble)) return true;
    }
  }

  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3);
    if (isDirectlyValid(stem)) return true;
    const stemE = stem + 'e';
    if (isDirectlyValid(stemE)) return true;
    
    if (word.charAt(word.length - 4) === word.charAt(word.length - 5)) {
      const stemDouble = word.slice(0, -4);
      if (isDirectlyValid(stemDouble)) return true;
    }
  }

  if (word.endsWith('er') && word.length > 4) {
    const stem = word.slice(0, -2);
    if (isDirectlyValid(stem)) return true;
    const stemE = stem + 'e';
    if (isDirectlyValid(stemE)) return true;
    if (word.length > 5 && word.charAt(word.length - 3) === word.charAt(word.length - 4)) {
      const stemDouble = word.slice(0, -3);
      if (isDirectlyValid(stemDouble)) return true;
    }
  }
  if (word.endsWith('est') && word.length > 5) {
    const stem = word.slice(0, -3);
    if (isDirectlyValid(stem)) return true;
    const stemE = stem + 'e';
    if (isDirectlyValid(stemE)) return true;
    if (word.length > 6 && word.charAt(word.length - 4) === word.charAt(word.length - 5)) {
      const stemDouble = word.slice(0, -4);
      if (isDirectlyValid(stemDouble)) return true;
    }
  }

  return false;
}

function calculateScore(word: string): number {
  let score = 0;
  for (const ch of word.toLowerCase()) {
    score += SCRABBLE_TILE_VALUES[ch] ?? 0;
  }
  return score;
}

function getSignature(word: string): string {
  return word.toLowerCase().split('').sort().join('');
}

interface WordEntry {
  word: string;
  score: number;
  length: number;
}

interface BuildResult {
  allWords: WordEntry[];
  index: Map<string, WordEntry[]>;
  topWords: string[];
}

function buildDictionary(wordsPath: string): BuildResult {
  const raw = fs.readFileSync(wordsPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const index = new Map<string, WordEntry[]>();
  const allWords: WordEntry[] = [];

  for (const line of lines) {
    const word = line.trim().toLowerCase();
    if (!word || word.length < 2 || word.length > 15) continue;
    if (!/^[a-z]+$/.test(word)) continue;
    
    // Filter out useless, non-English words
    if (!isValidEnglishWord(word)) continue;

    const entry: WordEntry = {
      word,
      score: calculateScore(word),
      length: word.length,
    };

    allWords.push(entry);

    const sig = getSignature(word);
    const existing = index.get(sig) ?? [];
    existing.push(entry);
    index.set(sig, existing);
  }

  // Sort each bucket
  for (const [sig, entries] of index.entries()) {
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.length !== a.length) return b.length - a.length;
      return a.word.localeCompare(b.word);
    });
    index.set(sig, entries);
  }

  // Top words for pSEO (highest scoring + most useful)
  const topWords = [...allWords]
    .sort((a, b) => b.score - a.score || b.length - a.length)
    .slice(0, 5000)
    .map((e) => e.word);

  return { allWords, index, topWords };
}

// Generate compact client dictionary (JSON, not TypeScript source)
// Include ALL valid words up to 8 letters — no score-based filtering
function generateClientDictionary(result: BuildResult): void {
  // Client dictionary strategy: ALL valid words <= 8 letters
  // No score-based filtering — every real English word must be findable
  const clientWords = result.allWords.filter((w) => w.length <= 8);
  
  // Compact format: only store word strings in index, calculate scores on the fly
  const clientIndex: Record<string, string[]> = {};
  
  for (const entry of clientWords) {
    const sig = getSignature(entry.word);
    const words = clientIndex[sig] ?? [];
    words.push(entry.word);
    clientIndex[sig] = words;
  }
  
  // Sort words within each signature bucket by score desc
  const scoreMap = new Map(result.allWords.map(w => [w.word, w.score]));
  for (const sig of Object.keys(clientIndex)) {
    clientIndex[sig].sort((a, b) => {
      const scoreA = scoreMap.get(a) ?? 0;
      const scoreB = scoreMap.get(b) ?? 0;
      return scoreB - scoreA || a.localeCompare(b);
    });
  }
  
  const clientDict = {
    index: clientIndex,
    totalWords: clientWords.length,
  };

  const outputPath = path.join(__dirname, '../src/lib/dictionary-client.json');
  fs.writeFileSync(outputPath, JSON.stringify(clientDict));
  console.log(`Client dictionary: ${clientWords.length} words, ${(fs.statSync(outputPath).size / 1024).toFixed(0)} KB`);
}

// Generate server dictionary module (full index, used by Astro pages at build time)
function generateServerDictionary(result: BuildResult): void {
  const indexObj: Record<string, WordEntry[]> = {};
  for (const [sig, words] of result.index.entries()) {
    indexObj[sig] = words;
  }

  const jsonContent = {
    totalWords: result.allWords.length,
    maxWordLength: 15,
    index: indexObj
  };

  const jsonOutputPath = path.join(__dirname, '../src/lib/dictionary-server.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonContent));
  console.log(`Server dictionary JSON: ${result.allWords.length} words, ${(fs.statSync(jsonOutputPath).size / 1024).toFixed(0)} KB`);

  // Write a small helper TS file that reads the JSON at build/run time
  const tsContent = `// AUTO-GENERATED — DO NOT EDIT
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export type WordEntry = { readonly word: string; readonly score: number; readonly length: number };

export const TOTAL_WORDS = ${result.allWords.length};
export const MAX_WORD_LENGTH = 15;

let cachedDict: {
  readonly index: ReadonlyMap<string, readonly WordEntry[]>;
  readonly totalWords: number;
  readonly maxWordLength: number;
} | null = null;

export function createServerDictionary() {
  if (cachedDict) return cachedDict;

  let jsonPath = '';
  const possiblePaths = [
    path.join(process.cwd(), 'src/lib/dictionary-server.json'),
    path.join(process.cwd(), 'dictionary-server.json'),
    fileURLToPath(new URL('./dictionary-server.json', import.meta.url)),
    fileURLToPath(new URL('../src/lib/dictionary-server.json', import.meta.url)),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        jsonPath = p;
        break;
      }
    } catch {}
  }

  if (!jsonPath) {
    throw new Error('Could not find dictionary-server.json in paths: ' + JSON.stringify(possiblePaths));
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);

  const index = new Map<string, readonly WordEntry[]>();
  for (const [sig, words] of Object.entries(data.index)) {
    index.set(sig, Object.freeze(words as WordEntry[]));
  }

  cachedDict = Object.freeze({
    index: Object.freeze(index),
    totalWords: data.totalWords,
    maxWordLength: data.maxWordLength,
  });

  return cachedDict;
}
`;

  const tsOutputPath = path.join(__dirname, '../src/lib/dictionary-server.ts');
  fs.writeFileSync(tsOutputPath, tsContent);
  console.log(`Server dictionary wrapper: ${(fs.statSync(tsOutputPath).size / 1024).toFixed(1)} KB`);
}

// Generate top words module for pSEO page generation
function generateTopWordsModule(topWords: string[]): void {
  const module = `// AUTO-GENERATED — DO NOT EDIT
export const TOP_WORDS: readonly string[] = Object.freeze([${topWords.slice(0, 1000).map(w => `"${w}"`).join(',')}]);
export const ALL_TOP_WORDS: readonly string[] = Object.freeze([${topWords.map(w => `"${w}"`).join(',')}]);
`;
  fs.writeFileSync(path.join(__dirname, '../src/lib/top-words.ts'), module);
}

// Main
const wordsPath = path.join(__dirname, '../data/words.txt');

console.log('Building dictionary...');
const result = buildDictionary(wordsPath);
console.log(`Indexed ${result.allWords.length} words, ${result.index.size} signatures`);

// Clean up old files
const oldFiles = [
  path.join(__dirname, '../src/lib/dictionary-data.ts'),
];
for (const f of oldFiles) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

generateClientDictionary(result);
generateServerDictionary(result);
generateTopWordsModule(result.topWords);

console.log('Done!');
