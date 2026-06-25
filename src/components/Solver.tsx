import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import type { WordEntry, SolverResult } from '../types';
import { solve, groupResultsByLength } from '../lib/solver';
import { createClientDictionary } from '../lib/dictionary-client';
import { track } from '../services/analytics';

const dictionary = createClientDictionary();

interface SolverProps {
  initialLetters?: string;
}

export default function Solver({ initialLetters = '' }: SolverProps) {
  const [input, setInput] = useState(initialLetters);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedWord, setCopiedWord] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchStartRef = useRef<number>(0);

  const performSearch = useCallback((value: string) => {
    const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
    
    if (!normalized || normalized.length < 2) {
      setResult(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    searchStartRef.current = performance.now();

    try {
      const solverResult = solve(dictionary, normalized);
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
  }, []);

  const handleInput = useCallback((value: string) => {
    setInput(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.length >= 2) {
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 80);
    } else {
      setResult(null);
      setError(null);
    }
  }, [performSearch]);

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
    if (input.length >= 3 && input.length < 4) {
      track('search.started', { inputLength: input.length });
    }
  }, [input]);

  const grouped = result ? groupResultsByLength(result.words) : [];
  const totalWords = result?.words.length ?? 0;
  const longestWord = result?.words[0] ?? null;
  const highestScoringWord = result?.words.reduce((best, current) => 
    current.score > best.score ? current : best, result.words[0] ?? { word: '', score: 0, length: 0 }
  ) ?? null;

  return (
    <div class="w-full max-w-3xl mx-auto">
      {/* Search Input (Clean Dashboard Style) */}
      <div class="relative group">
        <label for="solver-input" class="sr-only">Enter letters to unscramble</label>
        <input
          ref={inputRef}
          id="solver-input"
          type="text"
          value={input}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          placeholder="Enter scrambled letters (e.g., listen)..."
          class="w-full px-5 py-4 text-lg sm:text-xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] transition-all shadow-sm"
          maxLength={15}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          aria-describedby="solver-hint"
        />
        <div id="solver-hint" class="sr-only">
          Type letters to instantly unscramble them into valid words. Press / to focus.
        </div>
        
        {/* Input indicators */}
        <div class="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3">
          {isLoading && (
            <div class="w-5 h-5 border-2 border-slate-200 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin" />
          )}
          <kbd class="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2 font-mono text-[10px] font-bold text-slate-400">
            /
          </kbd>
        </div>
      </div>

      {/* Stats Bar */}
      {result && totalWords > 0 && (
        <div class="mt-4 grid grid-cols-3 gap-4 text-center">
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
          <p class="text-[var(--color-muted)] text-sm mt-1">Try adding different letters or check your spelling.</p>
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
                        <span class="uppercase tracking-wide font-extrabold">{word.word}</span>
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
