import { useState, useEffect } from 'preact/hooks';
import { createClientDictionary } from '../lib/dictionary-client';
import { track } from '../services/analytics';

const dictionary = createClientDictionary();

export default function WordleSolver() {
  const [green, setGreen] = useState<string[]>(['', '', '', '', '']);
  const [yellow, setYellow] = useState('');
  const [gray, setGray] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [copiedWord, setCopiedWord] = useState<string | null>(null);

  // Extract all 5-letter words from dictionary
  const getFiveLetterWords = () => {
    const list: string[] = [];
    for (const words of dictionary.index.values()) {
      for (const entry of words) {
        if (entry.length === 5) {
          list.push(entry.word);
        }
      }
    }
    return [...new Set(list)];
  };

  useEffect(() => {
    const allWords = getFiveLetterWords();
    const cleanYellow = yellow.toLowerCase().replace(/[^a-z]/g, '').split('');
    const cleanGray = gray.toLowerCase().replace(/[^a-z]/g, '').split('');

    // Filter out gray letters that are already marked green or yellow
    const activeGreenLetters = green.map(l => l.toLowerCase());
    const excludedLetters = cleanGray.filter(
      char => !activeGreenLetters.includes(char) && !cleanYellow.includes(char)
    );

    const matches = allWords.filter(word => {
      // 1. Green check (exact positions)
      for (let i = 0; i < 5; i++) {
        if (activeGreenLetters[i] && word[i] !== activeGreenLetters[i]) {
          return false;
        }
      }

      // 2. Yellow check (contains letter)
      for (const char of cleanYellow) {
        if (!word.includes(char)) {
          return false;
        }
      }

      // 3. Gray check (does not contain letter)
      for (const char of excludedLetters) {
        if (word.includes(char)) {
          return false;
        }
      }

      return true;
    });

    // Sort matches alphabetically
    matches.sort();
    setSuggestions(matches);
  }, [green, yellow, gray]);

  const handleGreenChange = (index: number, val: string) => {
    const letter = val.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();
    const newGreen = [...green];
    newGreen[index] = letter;
    setGreen(newGreen);

    // Auto-focus next input
    if (letter && index < 4) {
      const nextInput = document.getElementById(`green-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleGreenKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !green[index] && index > 0) {
      const newGreen = [...green];
      newGreen[index - 1] = '';
      setGreen(newGreen);
      const prevInput = document.getElementById(`green-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleCopy = async (word: string) => {
    try {
      await navigator.clipboard.writeText(word);
      setCopiedWord(word);
      track('wordle.word_copied', { word });
      setTimeout(() => setCopiedWord(null), 1500);
    } catch {
      // Silently ignore
    }
  };

  const handleReset = () => {
    setGreen(['', '', '', '', '']);
    setYellow('');
    setGray('');
    track('wordle.reset', {});
  };

  return (
    <div class="w-full max-w-2xl mx-auto space-y-8">
      <div class="panel p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3 mb-1">
          <h2 class="text-lg font-bold text-[var(--color-foreground)] flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            Wordle Puzzle Inputs
          </h2>
          <button
            onClick={handleReset}
            class="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
          >
            Clear Board
          </button>
        </div>

        {/* Green Row: Exact Position Grid */}
        <div class="space-y-2">
          <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Green Letters (Correct Positions)
          </label>
          <div class="flex justify-center gap-2">
            {green.map((val, idx) => (
              <input
                key={idx}
                id={`green-${idx}`}
                type="text"
                value={val}
                onInput={(e) => handleGreenChange(idx, (e.target as HTMLInputElement).value)}
                onKeyDown={(e) => handleGreenKeyDown(idx, e)}
                class={`w-12 h-12 text-center text-xl sm:text-2xl font-black rounded-xl border-2 transition-all uppercase outline-none focus:ring-4 focus:ring-green-500/20 ${
                  val
                    ? 'bg-green-600 border-green-700 text-white shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
                }`}
                maxLength={1}
                autocomplete="off"
                autocapitalize="off"
                spellcheck={false}
              />
            ))}
          </div>
        </div>

        {/* Yellow and Gray Input Fields */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label for="yellow-input" class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Yellow Letters (Present in Word)
            </label>
            <input
              id="yellow-input"
              type="text"
              value={yellow}
              onInput={(e) => setYellow((e.target as HTMLInputElement).value)}
              placeholder="e.g. AR"
              class="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/10 rounded-xl text-sm font-bold uppercase tracking-widest text-[var(--color-foreground)] placeholder:normal-case placeholder:font-normal placeholder:tracking-normal outline-none"
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label for="gray-input" class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Gray Letters (Absent / Excluded)
            </label>
            <input
              id="gray-input"
              type="text"
              value={gray}
              onInput={(e) => setGray((e.target as HTMLInputElement).value)}
              placeholder="e.g. STEL"
              class="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 rounded-xl text-sm font-bold uppercase tracking-widest text-[var(--color-foreground)] placeholder:normal-case placeholder:font-normal placeholder:tracking-normal outline-none"
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
            />
          </div>
        </div>
      </div>

      {/* Suggestions Results */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-extrabold text-lg text-[var(--color-foreground)]">
            Suggested Words
          </h3>
          <span class="px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-slate-200 dark:border-slate-800 text-xs font-bold text-[var(--color-muted)] shadow-sm">
            {suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {suggestions.length > 0 ? (
          <div class="panel p-5 bg-white dark:bg-slate-900">
            <div class="flex flex-wrap gap-2.5">
              {suggestions.map((word) => (
                <div key={word} class="relative group/tile flex items-center">
                  <a
                    href={`/unscramble/${word}/`}
                    class="word-tile pl-4 pr-11 py-2 rounded-xl text-sm font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center transition-all hover:pr-12"
                    title={`Details for ${word.toUpperCase()}`}
                  >
                    {word}
                  </a>
                  <button
                    onClick={() => handleCopy(word)}
                    class="absolute right-2 p-1.5 text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title={`Copy ${word}`}
                    aria-label={`Copy ${word}`}
                  >
                    {copiedWord === word ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-green-500"><path d="M20 6 9 17l-5-5"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div class="text-center py-8 panel bg-white dark:bg-slate-900">
            <p class="text-[var(--color-foreground)] font-bold">No matching 5-letter words found</p>
            <p class="text-[var(--color-muted)] text-sm mt-1">Try relaxing your letter criteria or clearing filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
