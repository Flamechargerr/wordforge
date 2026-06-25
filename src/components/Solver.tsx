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
      {/* Search Input (Spotlight/Command Bar Style) */}
      <div class="relative group">
        <label for="solver-input" class="sr-only">Enter letters to unscramble</label>
        <input
          ref={inputRef}
          id="solver-input"
          type="text"
          value={input}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          placeholder="Enter scrambled letters (e.g., listen)..."
          class="w-full px-6 py-5 text-xl sm:text-2xl bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent)]/10 transition-all duration-200 shadow-lg"
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
            <div class="w-5 h-5 border-2 border-slate-300 dark:border-slate-700 border-t-[var(--color-accent)] rounded-full animate-spin" />
          )}
          <kbd class="hidden sm:inline-flex h-6 select-none items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-2 font-mono text-[10px] font-bold text-[var(--color-muted)]">
            /
          </kbd>
        </div>
      </div>

      {/* Stats Bar */}
      {result && totalWords > 0 && (
        <div class="mt-6 grid grid-cols-3 gap-4 text-center">
          <div class="glass-panel rounded-2xl p-4">
            <div class="text-3xl font-extrabold text-[var(--color-foreground)]">{totalWords}</div>
            <div class="text-xs text-[var(--color-muted)] font-medium uppercase tracking-widest mt-1">Total Words</div>
          </div>
          <div class="glass-panel rounded-2xl p-4">
            <div class="text-3xl font-extrabold text-[var(--color-accent)]">{longestWord?.word.length ?? 0}</div>
            <div class="text-xs text-[var(--color-muted)] font-medium uppercase tracking-widest mt-1">Max Letters</div>
          </div>
          <div class="glass-panel rounded-2xl p-4">
            <div class="text-3xl font-extrabold text-[var(--color-success)]">{highestScoringWord?.score ?? 0}</div>
            <div class="text-xs text-[var(--color-muted)] font-medium uppercase tracking-widest mt-1">Best Score</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div class="mt-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium animate-fade-in" role="alert">
          {error}
        </div>
      )}

      {/* Empty State */}
      {result && totalWords === 0 && !error && (
        <div class="mt-12 text-center animate-fade-in py-8">
          <svg class="w-12 h-12 text-[var(--color-muted)] mx-auto mb-3 opacity-60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
          </svg>
          <p class="text-[var(--color-foreground)] font-semibold text-lg">No valid words found</p>
          <p class="text-[var(--color-muted)] text-sm mt-1">Try adding more letters or double check your spelling.</p>
        </div>
      )}

      {/* Results */}
      {result && totalWords > 0 && (
        <div class="mt-8 space-y-6 animate-fade-in">
          {/* Copy All */}
          <div class="flex justify-end">
            <button
              onClick={handleCopyAll}
              class="px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:text-white bg-[var(--color-surface)] hover:bg-[var(--color-accent)] border border-[var(--color-border)] hover:border-transparent rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              aria-label="Copy all words"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              {copiedWord === '__all__' ? 'Copied Everything!' : 'Copy All'}
            </button>
          </div>

          {/* Grouped Results */}
          {grouped.map((group) => (
            <div key={group.length} class="glass-panel rounded-2xl overflow-hidden shadow-sm">
              <div class="px-5 py-4 bg-gradient-to-r from-[var(--color-accent-subtle)] to-transparent border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 class="font-bold text-base text-[var(--color-foreground)]">
                  {group.length} Letter{group.length !== 1 ? 's' : ''}
                </h3>
                <span class="px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)]">
                  {group.words.length} word{group.words.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div class="p-5">
                <div class="flex flex-wrap gap-2.5">
                  {group.words.map((word) => (
                    <button
                      key={word.word}
                      onClick={() => handleCopy(word.word)}
                      class="word-tile group relative px-4 py-2.5 rounded-xl transition-all text-sm font-semibold text-[var(--color-foreground)] flex items-center gap-2 cursor-pointer"
                      title={`Score: ${word.score} | Click to copy`}
                      aria-label={`Copy ${word.word}`}
                    >
                      <span class="uppercase tracking-wide font-bold">{word.word}</span>
                      <span class="w-5 h-5 rounded-md bg-[var(--color-background)] group-hover:bg-white border border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                        {word.score}
                      </span>
                      {copiedWord === word.word && (
                        <span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--color-success)] rounded-full ring-2 ring-[var(--color-background)]" aria-hidden="true" />
                      )}
                    </button>
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
