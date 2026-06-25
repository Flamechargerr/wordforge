import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import type { WordEntry, SolverResult, Dictionary } from '../types';
import { solve, groupResultsByLength } from '../lib/solver';
import { createClientDictionary } from '../lib/dictionary-client';
import { track } from '../services/analytics';

interface SolverProps {
  initialLetters?: string;
  mode?: 'unscramble' | 'anagram';
}

const SCRABBLE_SCORES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
  n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10
};

const WWF_SCORES: Record<string, number> = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 3, g: 2, h: 2, i: 1, j: 8, k: 4, l: 1, m: 2,
  n: 1, o: 1, p: 2, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 3, x: 8, y: 2, z: 10
};

export default function Solver({ initialLetters = '', mode = 'unscramble' }: SolverProps) {
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [input, setInput] = useState(initialLetters);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedWord, setCopiedWord] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchStartRef = useRef<number>(0);

  // Advanced options states
  const [showOptions, setShowOptions] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [contains, setContains] = useState('');
  const [gameMode, setGameMode] = useState<'scrabble' | 'wwf'>('scrabble');

  // Inspector modal states
  const [inspectingWord, setInspectingWord] = useState<string | null>(null);
  const [definitionData, setDefinitionData] = useState<any | null>(null);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);

  // Load client dictionary on mount
  useEffect(() => {
    createClientDictionary().then(setDictionary);
  }, []);

  const performSearch = useCallback((
    value: string,
    opts: { pref?: string; suff?: string; cont?: string; game?: 'scrabble' | 'wwf' } = {}
  ) => {
    if (!dictionary) return;

    // Keep wildcards (?, *, space)
    const normalized = value.toLowerCase().replace(/[^a-z?* ]/g, '');
    const letterOnlyLength = normalized.replace(/[?* ]/g, '').length;

    if (!normalized || letterOnlyLength < 2) {
      setResult(null);
      setError(null);
      return;
    }

    const activePrefix = opts.pref !== undefined ? opts.pref : prefix;
    const activeSuffix = opts.suff !== undefined ? opts.suff : suffix;
    const activeContains = opts.cont !== undefined ? opts.cont : contains;
    const activeGameMode = opts.game !== undefined ? opts.game : gameMode;

    setIsLoading(true);
    setError(null);
    searchStartRef.current = performance.now();

    try {
      const isAnagramMode = mode === 'anagram';
      const minLength = isAnagramMode ? normalized.length : 2;
      const maxLength = isAnagramMode ? normalized.length : normalized.length;

      const solverResult = solve(dictionary, normalized, {
        minLength,
        maxLength,
        prefix: activePrefix || undefined,
        suffix: activeSuffix || undefined,
        contains: activeContains || undefined,
        gameMode: activeGameMode,
      });

      setResult(solverResult);
      setIsLoading(false);

      // Analytics
      const duration = performance.now() - searchStartRef.current;
      track(solverResult.words.length === 0 ? 'search.zero_results' : 'search.completed', {
        duration: Math.round(duration),
        wordCount: solverResult.words.length,
        inputLength: normalized.length,
      });
    } catch (err) {
      setIsLoading(false);
      setError('Something went wrong. Please try again.');
      track('search.error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        inputLength: normalized.length,
      });
    }
  }, [prefix, suffix, contains, gameMode, mode, dictionary]);

  // Run initial search once dictionary is loaded
  useEffect(() => {
    if (dictionary && initialLetters) {
      performSearch(initialLetters);
    }
  }, [dictionary, initialLetters, performSearch]);

  const handleInput = useCallback((value: string) => {
    // Keep a-z and wildcards
    const cleaned = value.replace(/[^a-zA-Z?* ]/g, '');
    setInput(cleaned);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const letterOnlyLength = cleaned.replace(/[?* ]/g, '').length;
    if (letterOnlyLength >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(cleaned);
      }, 80);
    } else {
      setResult(null);
      setError(null);
    }
  }, [performSearch]);

  const handlePrefixChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z]/g, '');
    setPrefix(clean);
    performSearch(input, { pref: clean });
  };

  const handleSuffixChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z]/g, '');
    setSuffix(clean);
    performSearch(input, { suff: clean });
  };

  const handleContainsChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z]/g, '');
    setContains(clean);
    performSearch(input, { cont: clean });
  };

  const handleGameModeChange = (modeVal: 'scrabble' | 'wwf') => {
    setGameMode(modeVal);
    performSearch(input, { game: modeVal });
  };

  const handleInspectWord = useCallback((word: string) => {
    setInspectingWord(word);
    setIsLoadingDefinition(true);
    setDefinitionData(null);
    track('word.inspect', { word, inputLength: input.length });

    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        if (data && data[0]) {
          setDefinitionData(data[0]);
        }
        setIsLoadingDefinition(false);
      })
      .catch(() => {
        setDefinitionData(null);
        setIsLoadingDefinition(false);
      });
  }, [input.length]);

  const handleCloseModal = useCallback(() => {
    setInspectingWord(null);
    setDefinitionData(null);
  }, []);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      handleCloseModal();
    }
  }, [handleCloseModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    if (inspectingWord) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inspectingWord, handleCloseModal]);

  const handleCopy = useCallback(async (word: string) => {
    try {
      await navigator.clipboard.writeText(word);
      setCopiedWord(word);
      track('word.copied', { inputLength: input.length });
      setTimeout(() => setCopiedWord(null), 1500);
    } catch {
      // Silently fail — copy is a nice-to-have
    }
  }, [input]);

  const handleCopyAll = useCallback(async () => {
    if (!result || result.words.length === 0) return;
    const allWords = result.words.map(w => w.word).join(', ');
    try {
      await navigator.clipboard.writeText(allWords);
      setCopiedWord('__all__');
      track('word.copied_all', { wordCount: result.words.length });
      setTimeout(() => setCopiedWord(null), 1500);
    } catch {
      // Silently fail
    }
  }, [result]);

  // Keyboard shortcut: focus input on /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track search start
  useEffect(() => {
    const letterOnlyLength = input.replace(/[?* ]/g, '').length;
    if (letterOnlyLength >= 3 && letterOnlyLength < 4) {
      track('search.started', { inputLength: input.length });
    }
  }, [input]);

  const grouped = result ? groupResultsByLength(result.words) : [];
  const totalWords = result?.words.length ?? 0;
  const longestWord = result?.words[0] ?? null;
  const highestScoringWord = result?.words.reduce((best, current) =>
    current.score > best.score ? current : best, result.words[0] ?? { word: '', score: 0, length: 0 }
  ) ?? null;

  // Wildcard letter highlighter rendering tactile board-game tiles
  function renderWordWithWildcards(word: string, inputLetters: string) {
    const normalizedInput = inputLetters.toLowerCase().replace(/[^a-z?* ]/g, '');

    const available = new Map<string, number>();
    for (const ch of normalizedInput) {
      if (ch !== '?' && ch !== '*' && ch !== ' ') {
        available.set(ch, (available.get(ch) ?? 0) + 1);
      }
    }

    const chars = word.split('');
    return (
      <div class="flex gap-0.5" aria-label={word.toUpperCase()}>
        {chars.map((ch, idx) => {
          const lowerCh = ch.toLowerCase();
          const count = available.get(lowerCh) ?? 0;
          const isWild = count <= 0;
          
          if (!isWild) {
            available.set(lowerCh, count - 1);
          }
          
          const score = isWild ? 0 : (gameMode === 'scrabble' ? SCRABBLE_SCORES[lowerCh] : WWF_SCORES[lowerCh]) ?? 0;

          return (
            <span
              key={idx}
              class={`game-tile game-tile-sm ${isWild ? 'game-tile-blank font-black' : 'font-bold'}`}
              title={isWild ? `"${ch.toUpperCase()}" substituted from a blank tile` : undefined}
            >
              {ch.toUpperCase()}
              <span class="game-tile-points">{score}</span>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div class="w-full max-w-3xl mx-auto">
      {/* Search Input Block */}
      <div class="relative group">
        <label for="solver-input" class="sr-only">Enter letters to unscramble</label>
        
        {/* Search Icon */}
        <div class="absolute left-5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          <svg class="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          id="solver-input"
          type="text"
          value={input}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          placeholder={!dictionary ? "Loading dictionary database..." : mode === 'anagram' ? "Enter anagram letters (e.g., listen)..." : "Enter scrambled letters (use ?, * or space for blank)..."}
          class="w-full pl-12 pr-32 py-4 text-base sm:text-lg bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] transition-all shadow-sm focus:outline-none"
          maxLength={15}
          disabled={!dictionary}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          aria-describedby="solver-hint"
        />
        <div id="solver-hint" class="sr-only">
          Type letters to instantly unscramble them. Use ? or * or space for blank/wildcard tiles. Press / to focus.
        </div>

        {/* Input indicators */}
        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {(!dictionary || isLoading) && (
            <div class="w-5 h-5 border-2 border-slate-200 dark:border-slate-800/50 border-t-blue-600 rounded-full animate-spin" title={!dictionary ? "Loading dictionary database..." : "Searching..."} />
          )}
          <button
            onClick={() => setShowOptions(!showOptions)}
            class={`p-2 rounded-xl border transition-all cursor-pointer ${
              showOptions || prefix || suffix || contains || gameMode !== 'scrabble'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
            title="Advanced Search Filters & Options"
            aria-label="Toggle filters drawer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          </button>
          <kbd class="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 font-mono text-[10px] font-bold text-slate-400">
            /
          </kbd>
        </div>
      </div>

      {/* Wildcard Hint Text */}
      <div class="mt-2.5 px-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)] font-semibold mb-4">
        <span>💡 Enter <b>?</b>, <b>*</b>, or <b>space</b> to represent blank tiles.</span>
        {input.replace(/[^?* ]/g, '').length > 0 && (
          <span class="text-blue-600 dark:text-blue-400 font-bold">
            Active: {input.replace(/[^?* ]/g, '').length} Wildcard{input.replace(/[^?* ]/g, '').length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Dynamic 3D Wooden Tile Rack */}
      <div class="mb-6">
        <div class="tile-rack">
          {input.length === 0 ? (
            <div class="w-full text-center text-xs text-[#d7b28f] dark:text-[#a0744a] font-bold uppercase tracking-wider flex items-center justify-center h-8">
              Your tile rack is empty. Type letters above.
            </div>
          ) : (
            input.split('').map((char, idx) => {
              const isWild = char === '?' || char === '*' || char === ' ';
              const score = isWild ? 0 : (gameMode === 'scrabble' ? SCRABBLE_SCORES[char.toLowerCase()] : WWF_SCORES[char.toLowerCase()]) ?? 0;
              return (
                <div
                  key={idx}
                  class={`game-tile game-tile-lg ${isWild ? 'game-tile-blank font-black' : 'font-bold'} shadow-md transform hover:-translate-y-1 hover:shadow-lg transition-all`}
                >
                  {isWild ? '' : char.toUpperCase()}
                  <span class="game-tile-points">{score}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Expandable Advanced Options Drawer */}
      <div
        class={`overflow-hidden transition-all duration-300 ${
          showOptions ? 'max-h-[350px] mt-4 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div class="panel p-5 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-sm border-dashed space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3 mb-1">
            <h4 class="text-sm font-bold text-[var(--color-foreground)]">Advanced Filters</h4>
            <button
              onClick={() => {
                setPrefix('');
                setSuffix('');
                setContains('');
                setGameMode('scrabble');
                performSearch(input, { pref: '', suff: '', cont: '', game: 'scrabble' });
              }}
              class="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="prefix-input" class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Starts With</label>
              <input
                id="prefix-input"
                type="text"
                value={prefix}
                onInput={(e) => handlePrefixChange((e.target as HTMLInputElement).value)}
                placeholder="e.g. S"
                class="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl text-sm"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="suffix-input" class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ends With</label>
              <input
                id="suffix-input"
                type="text"
                value={suffix}
                onInput={(e) => handleSuffixChange((e.target as HTMLInputElement).value)}
                placeholder="e.g. ING"
                class="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl text-sm"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="contains-input" class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Must Include</label>
              <input
                id="contains-input"
                type="text"
                value={contains}
                onInput={(e) => handleContainsChange((e.target as HTMLInputElement).value)}
                placeholder="e.g. T"
                class="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 rounded-xl text-sm"
              />
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Game Scoring System</span>
              <p class="text-[11px] text-[var(--color-muted)] font-medium">Recalculates letter values and resort matches by score.</p>
            </div>
            <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit border border-slate-200/50 dark:border-slate-700/50">
              <button
                onClick={() => handleGameModeChange('scrabble')}
                class={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  gameMode === 'scrabble'
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Scrabble
              </button>
              <button
                onClick={() => handleGameModeChange('wwf')}
                class={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  gameMode === 'wwf'
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Words With Friends
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {result && totalWords > 0 && (
        <div class="mt-5 grid grid-cols-3 gap-4 text-center">
          <div class="panel p-4">
            <div class="text-3xl font-extrabold text-[var(--color-foreground)]">{totalWords}</div>
            <div class="text-xs text-[var(--color-muted)] font-bold uppercase tracking-wider mt-1">Total Words</div>
          </div>
          <div class="panel p-4">
            <div class="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{longestWord?.word.length ?? 0}</div>
            <div class="text-xs text-[var(--color-muted)] font-bold uppercase tracking-wider mt-1">Max Letters</div>
          </div>
          <div class="panel p-4">
            <div class="text-3xl font-extrabold text-green-600 dark:text-green-400">{highestScoringWord?.score ?? 0}</div>
            <div class="text-xs text-[var(--color-muted)] font-bold uppercase tracking-wider mt-1">Best Score</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div class="mt-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-semibold" role="alert">
          {error}
        </div>
      )}

      {/* Empty State */}
      {result && totalWords === 0 && !error && (
        <div class="mt-12 text-center py-8 panel">
          <p class="text-[var(--color-foreground)] font-bold text-lg">No valid words found</p>
          <p class="text-[var(--color-muted)] text-sm mt-1">Try adding different letters or adjusting your filters.</p>
        </div>
      )}

      {/* Results */}
      {result && totalWords > 0 && (
        <div class="mt-6 space-y-4">
          {/* Copy All */}
          <div class="flex justify-end">
            <button
              onClick={handleCopyAll}
              class="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white bg-white dark:bg-slate-800 hover:bg-blue-600 dark:hover:bg-blue-600 border border-slate-200 dark:border-slate-700 hover:border-transparent rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              aria-label="Copy all words"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              {copiedWord === '__all__' ? 'Copied Everything!' : 'Copy All'}
            </button>
          </div>

          {/* Grouped Results */}
          {grouped.map((group) => (
            <div key={group.length} class="panel rounded-xl overflow-hidden shadow-sm">
              <div class="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 class="font-extrabold text-base text-[var(--color-foreground)]">
                  {group.length} Letter{group.length !== 1 ? 's' : ''}
                </h3>
                <span class="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-[var(--color-muted)]">
                  {group.words.length} word{group.words.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div class="p-5">
                <div class="flex flex-wrap gap-2.5">
                  {group.words.map((word) => (
                    <div key={word.word} class="relative group/tile flex items-center">
                      <a
                        href={`/unscramble/${word.word}/`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleInspectWord(word.word);
                        }}
                        class="word-tile pl-4 pr-11 py-2.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 transition-all hover:pr-12"
                        title={`View definition & details for ${word.word.toUpperCase()}`}
                      >
                        {renderWordWithWildcards(word.word, input)}
                        <span class="score-badge">
                          {word.score}
                        </span>
                      </a>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopy(word.word);
                        }}
                        class="absolute right-2.5 p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title={`Copy ${word.word}`}
                        aria-label={`Copy ${word.word}`}
                      >
                        {copiedWord === word.word ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-green-500"><path d="M20 6 9 17l-5-5"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Solve Time (subtle) */}
          <p class="text-xs text-[var(--color-muted)] text-center font-medium">
            Solved in {result.solveTimeMs.toFixed(1)}ms
            {result.wasTruncated && ' · Input truncated to 12 letters for performance'}
          </p>
        </div>
      )}

      {/* Word Inspector Modal */}
      {inspectingWord && (
        <div class="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-container max-h-[85vh] flex flex-col p-6 relative">
            {/* Close button */}
            <button
              onClick={handleCloseModal}
              class="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            {/* Word Tiles display */}
            <div class="flex flex-col items-center gap-3 mt-4 mb-6">
              <div class="flex gap-1 flex-wrap justify-center">
                {inspectingWord.split('').map((char, idx) => {
                  const normalizedInput = input.toLowerCase().replace(/[^a-z?* ]/g, '');
                  const isWild = !normalizedInput.includes(char.toLowerCase());
                  const score = isWild ? 0 : (gameMode === 'scrabble' ? SCRABBLE_SCORES[char.toLowerCase()] : WWF_SCORES[char.toLowerCase()]) ?? 0;
                  return (
                    <div key={idx} class={`game-tile game-tile-lg ${isWild ? 'game-tile-blank font-black' : 'font-bold'} shadow-sm`}>
                      {char.toUpperCase()}
                      <span class="game-tile-points">{score}</span>
                    </div>
                  );
                })}
              </div>
              <h2 id="modal-title" class="sr-only">Details for {inspectingWord.toUpperCase()}</h2>
            </div>

            {/* Score Breakdown Panel */}
            <div class="grid grid-cols-2 gap-3 mb-6">
              <div class="panel p-3.5 text-center bg-slate-50 dark:bg-slate-900/30">
                <span class="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {inspectingWord.split('').reduce((acc, char) => acc + (SCRABBLE_SCORES[char.toLowerCase()] ?? 0), 0)}
                </span>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mt-1">Scrabble Score</p>
              </div>
              <div class="panel p-3.5 text-center bg-slate-50 dark:bg-slate-900/30">
                <span class="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {inspectingWord.split('').reduce((acc, char) => acc + (WWF_SCORES[char.toLowerCase()] ?? 0), 0)}
                </span>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mt-1">WWF Score</p>
              </div>
            </div>

            {/* Content area */}
            <div class="flex-1 overflow-y-auto pr-1 space-y-4 min-h-[150px]">
              {isLoadingDefinition ? (
                /* Skeleton loader */
                <div class="space-y-3 animate-pulse">
                  <div class="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                  <div class="h-10 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div class="h-14 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              ) : definitionData ? (
                /* Definition Data */
                <div class="space-y-4">
                  <h4 class="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dictionary Meanings</h4>
                  {definitionData.meanings.slice(0, 3).map((meaning: any, index: number) => (
                    <div key={index} class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md">
                          {meaning.partOfSpeech}
                        </span>
                        {meaning.definitions[0]?.example && (
                          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Has example</span>
                        )}
                      </div>
                      <p class="text-sm text-slate-700 dark:text-slate-350 leading-relaxed font-semibold">
                        {meaning.definitions[0]?.definition}
                      </p>
                      {meaning.definitions[0]?.example && (
                        <p class="text-xs text-slate-400 dark:text-slate-500 italic pl-3 border-l-2 border-slate-200 dark:border-slate-800">
                          "{meaning.definitions[0].example}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Not Found fallback */
                <div class="text-center py-6 text-slate-400 dark:text-slate-500 space-y-2">
                  <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <p class="text-sm font-bold">Valid game word list entry</p>
                  <p class="text-xs font-semibold">This is a verified game word, but no standard english dictionary definition could be retrieved online.</p>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div class="border-t border-slate-100 dark:border-slate-800/50 pt-4 mt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inspectingWord);
                  setCopiedWord(inspectingWord);
                  setTimeout(() => setCopiedWord(null), 1500);
                }}
                class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                {copiedWord === inspectingWord ? 'Copied to Clipboard!' : 'Copy Word'}
              </button>
              <a
                href={`/unscramble/${inspectingWord.toLowerCase()}/`}
                class="w-full py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-center font-bold rounded-xl text-xs text-slate-600 dark:text-slate-350 transition-all flex items-center justify-center gap-1"
              >
                <span>View Full Meaning, Anagrams & Stats</span>
                <span>&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
