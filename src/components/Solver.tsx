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
    <div class="w-full max-w-2xl mx-auto">
      {/* Search Input */}
      <div class="relative">
        <label for="solver-input" class="sr-only">Enter letters to unscramble</label>
        <input
          ref={inputRef}
          id="solver-input"
          type="text"
          value={input}
          onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
          placeholder="Enter letters..."
          class="w-full px-5 py-4 text-lg sm:text-xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all shadow-sm"
          maxLength={15}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          aria-describedby="solver-hint"
        />
        <div id="solver-hint" class="sr-only">
          Type letters to instantly unscramble them into valid words. Press / to focus.
        </div>
        {isLoading && (
          <div class="absolute right-4 top-1/2 -translate-y-1/2">
            <div class="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {result && totalWords > 0 && (
        <div class="mt-4 grid grid-cols-3 gap-3 text-center">
          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
            <div class="text-2xl font-bold text-[var(--color-foreground)]">{totalWords}</div>
            <div class="text-xs text-[var(--color-muted)] uppercase tracking-wide">Words</div>
          </div>
          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
            <div class="text-2xl font-bold text-[var(--color-accent)]">{longestWord?.word.length ?? 0}</div>
            <div class="text-xs text-[var(--color-muted)] uppercase tracking-wide">Longest</div>
          </div>
          <div class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
            <div class="text-2xl font-bold text-[var(--color-success)]">{highestScoringWord?.score ?? 0}</div>
            <div class="text-xs text-[var(--color-muted)] uppercase tracking-wide">Best Score</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div class="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm animate-fade-in" role="alert">
          {error}
        </div>
      )}

      {/* Empty State */}
      {result && totalWords === 0 && !error && (
        <div class="mt-6 text-center animate-fade-in">
          <p class="text-[var(--color-muted)] text-lg">No words found.</p>
          <p class="text-[var(--color-muted)] text-sm mt-1">Try different letters or check your spelling.</p>
        </div>
      )}

      {/* Results */}
      {result && totalWords > 0 && (
        <div class="mt-6 space-y-4 animate-fade-in">
          {/* Copy All */}
          <div class="flex justify-end">
            <button
              onClick={handleCopyAll}
              class="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors flex items-center gap-1"
              aria-label="Copy all words"
            >
              {copiedWord === '__all__' ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          {/* Grouped Results */}
          {grouped.map((group) => (
            <div key={group.length} class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div class="px-4 py-3 bg-[var(--color-accent-subtle)] border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 class="font-semibold text-sm text-[var(--color-foreground)]">
                  {group.length} Letter{group.length !== 1 ? 's' : ''}
                </h3>
                <span class="text-xs text-[var(--color-muted)]">{group.words.length} word{group.words.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="p-4">
                <div class="flex flex-wrap gap-2">
                  {group.words.map((word) => (
                    <button
                      key={word.word}
                      onClick={() => handleCopy(word.word)}
                      class="group relative px-3 py-2 bg-[var(--color-background)] hover:bg-[var(--color-accent-subtle)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-lg transition-all text-sm font-medium text-[var(--color-foreground)]"
                      title={`Score: ${word.score} | Click to copy`}
                      aria-label={`Copy ${word.word}`}
                    >
                      <span class="uppercase tracking-wide">{word.word}</span>
                      <span class="ml-1.5 text-xs text-[var(--color-muted)] group-hover:text-[var(--color-accent)]">
                        {word.score}
                      </span>
                      {copiedWord === word.word && (
                        <span class="absolute -top-1 -right-1 w-2 h-2 bg-[var(--color-success)] rounded-full" aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Solve Time (subtle) */}
          <p class="text-xs text-[var(--color-muted)] text-center">
            Solved in {result.solveTimeMs.toFixed(1)}ms
            {result.wasTruncated && ' · Input truncated to 12 letters for performance'}
          </p>
        </div>
      )}
    </div>
  );
}
