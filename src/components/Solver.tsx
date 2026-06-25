import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import type { WordEntry, SolverResult } from '../types';
import { solve, groupResultsByLength } from '../lib/solver';
import { createClientDictionary } from '../lib/dictionary-client';
import { track } from '../services/analytics';

const dictionary = createClientDictionary();

interface SolverProps {
  initialLetters?: string;
  mode?: 'unscramble' | 'anagram';
}

export default function Solver({ initialLetters = '', mode = 'unscramble' }: SolverProps) {
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

  const performSearch = useCallback((
    value: string,
    opts: { pref?: string; suff?: string; cont?: string; game?: 'scrabble' | 'wwf' } = {}
  ) => {
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
  }, [prefix, suffix, contains, gameMode, mode]);

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

  // Wildcard letter highlighter
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
      <span class="uppercase tracking-wide font-extrabold flex gap-px">
        {chars.map((ch, idx) => {
          const lowerCh = ch.toLowerCase();
          const count = available.get(lowerCh) ?? 0;
          if (count > 0) {
            available.set(lowerCh, count - 1);
            return <span key={idx} class="text-slate-800 dark:text-slate-100">{ch}</span>;
          } else {
            return (
              <span
                key={idx}
                class="text-blue-600 dark:text-blue-400 underline decoration-2 decoration-blue-500/60 underline-offset-[3px] font-black"
                title="Substituted from blank tile"
              >
                {ch}
              </span>
            );
          }
        })}
      </span>
    );
  }

  return (
    <div class="w-full max-w-3xl mx-auto">
      {/* Search Input Block */}
      <div class="relative group">
        <label for="solver-input" class="sr-only">Enter letters to unscramble</label>
        <input
          ref={inputRef}
          id="solver-input"
          type="text"
          value={input}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          placeholder={mode === 'anagram' ? "Enter anagram letters (e.g., listen)..." : "Enter scrambled letters (use ?, * or space for blank)..."}
          class="w-full px-5 py-4 text-lg sm:text-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] transition-all shadow-sm"
          maxLength={15}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          aria-describedby="solver-hint"
        />
        <div id="solver-hint" class="sr-only">
          Type letters to instantly unscramble them. Use ? or * or space for blank/wildcard tiles. Press / to focus.
        </div>

        {/* Input indicators */}
        <div class="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
          {isLoading && (
            <div class="w-5 h-5 border-2 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin" />
          )}
          <button
            onClick={() => setShowOptions(!showOptions)}
            class={`p-2 rounded-xl border transition-all ${
              showOptions || prefix || suffix || contains || gameMode !== 'scrabble'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400'
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
      <div class="mt-2.5 px-1 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted)] font-semibold">
        <span>💡 Enter <b>?</b>, <b>*</b>, or <b>space</b> to represent blank tiles.</span>
        {input.replace(/[^?* ]/g, '').length > 0 && (
          <span class="text-blue-600 dark:text-blue-400 font-bold">
            Active: {input.replace(/[^?* ]/g, '').length} Wildcard{input.replace(/[^?* ]/g, '').length !== 1 ? 's' : ''}
          </span>
        )}
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
                        class="word-tile pl-4 pr-11 py-2.5 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 transition-all hover:pr-12"
                        title={`View definition & details for ${word.word.toUpperCase()}`}
                      >
                        {renderWordWithWildcards(word.word, input)}
                        <span class="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 group-hover:bg-white flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 transition-colors">
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
    </div>
  );
}
