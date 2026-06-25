# WordForge Architectural Decisions

## Status: Active — Version 1.0

---

## Decision 1: Astro over Next.js / Nuxt / SvelteKit

**Context:** We need a framework that delivers static HTML for SEO content while supporting interactive components for the solver.

**Decision:** Use Astro with Preact Islands.

**Rationale:**
- **Zero-JS by default:** All SEO content, FAQs, and pSEO pages ship as pure HTML with zero JavaScript. This directly improves LCP and TTI.
- **Islands architecture:** Only the solver component hydrates. The rest of the page is static.
- **No hydration tax:** Next.js ships React everywhere (~70KB). Astro ships nothing unless explicitly requested.
- **Future-proof:** If we later need APIs, Astro can add server endpoints. If we need SSR, it's supported.

**Trade-offs:**
- No built-in file-based API routes (Next.js has this). Mitigation: Astro server endpoints are simple to add.
- Smaller ecosystem than Next.js. Mitigation: We use Preact for interactivity, which has a React-compatible API.

**Consequences:**
- Lighthouse Performance scores will be significantly higher than a Next.js equivalent.
- The solver must be architected as a standalone island, not embedded in page logic.

---

## Decision 2: Preact Islands over React Islands

**Context:** Astro supports multiple UI frameworks via islands. We need interactivity only for the solver.

**Decision:** Use Preact for islands.

**Rationale:**
- **3KB vs 40KB:** Preact is ~10x smaller than React while maintaining the same API.
- **React compatibility:** Preact compat layer means React components work with minimal changes.
- **Astro first-class support:** `@astrojs/preact` is officially maintained.

**Trade-offs:**
- Minor edge cases in complex hooks (useLayoutEffect timing). Mitigation: We keep island logic simple.
- Dev tools less polished than React DevTools. Mitigation: Acceptable for a single island component.

---

## Decision 3: Build-Time Dictionary Index (Not Client-Side Fetch)

**Context:** The dictionary is ~370K words. Shipping it to the client requires ~1.5MB of JSON.

**Decision:** Generate a sorted-key index at build time, ship a compressed subset for client-side solving, and pre-render all pSEO pages server-side.

**Rationale:**
- **No network request on first solve:** The dictionary is bundled with the island chunk, not fetched separately.
- **Preact island loads dictionary:** The solver island loads the dictionary as an imported module, not a fetch.
- **pSEO pages use server-side data:** Astro pages import the dictionary directly at build time to generate static HTML.

**Trade-offs:**
- Initial island chunk is larger. Mitigation: The dictionary is compressed and only loaded when the solver mounts.
- Build time increases. Mitigation: ~30s for 370K words is acceptable.

**Consequences:**
- `src/lib/dictionary.ts` is the single source of truth for both server-side generation and client-side solving.
- No `public/dictionary.json` file needed.

---

## Decision 4: Sorted-Key Index over Trie

**Context:** Need O(1) lookups for anagram signatures.

**Decision:** Use a sorted-key (signature) index: `Map<string, WordEntry[]>`.

**Rationale:**
- **O(1) lookup:** Signature → words is a direct hash map access.
- **Simpler than Trie:** No tree traversal, no prefix matching complexity.
- **Fast subset generation:** For input letters, generate all subset signatures and look up each in O(1).
- **Memory efficient:** ~270K signatures for 370K words is manageable.

**Trade-offs:**
- Slightly more memory than a Trie. Mitigation: Only store words up to 12 letters for the client index.
- Doesn't support prefix-based autocomplete (which we don't need for V1).

---

## Decision 5: No Ads, No Auth, No Premium in V1

**Context:** The prompt explicitly excludes monetization features in V1.

**Decision:** Build only the core unscrambler. No login, no paywall, no ads, no AI features.

**Rationale:**
- **SEO-first strategy:** Google rewards fast, content-rich, ad-free sites. Monetization comes after organic traffic is established.
- **Scope discipline:** Every feature must improve traffic, CTR, retention, or task completion. Ads and auth do none of these in V1.
- **Performance:** Ads destroy Core Web Vitals. We need 95+ Lighthouse scores for ranking.

**Trade-offs:**
- No immediate revenue. Mitigation: Phase 2 roadmap includes AdSense and premium features.
- No user accounts. Mitigation: Not needed for a tool site.

---

## Decision 6: Debounced Instant Search (No Search Button)

**Context:** The UX spec calls for "no search button" — results appear as you type.

**Decision:** Debounce input at 80ms, solve on every valid keystroke, show results immediately.

**Rationale:**
- **Perceived speed:** Instant feedback feels faster than a button press, even if total time is the same.
- **Mobile-first:** Typing on mobile is slower; a button adds friction.
- **Task completion:** Users who type 5+ letters almost always want to solve. Auto-solving removes a step.

**Trade-offs:**
- More solver invocations. Mitigation: Debounce prevents excessive calls; solver is <10ms for typical inputs.
- Potential for jarring layout shifts if results change rapidly. Mitigation: Smooth transitions and result container min-height.

---

## Decision 7: Vitest over Jest

**Context:** Need a testing framework for the solver engine and utilities.

**Decision:** Use Vitest.

**Rationale:**
- **Native TypeScript:** No ts-jest or babel transforms.
- **Fast:** Uses esbuild for instant test runs.
- **Modern:** Native ESM support, watch mode, coverage via v8.
- **Small footprint:** Jest brings ~50MB of dependencies. Vitest is lean.

---

## Decision 8: Minimal JavaScript Philosophy

**Context:** Every KB of JS delays interactivity. The prompt demands minimal JS.

**Decision:** The only JavaScript on the homepage is the Preact island for the solver. Everything else is static HTML.

**Rationale:**
- **Largest Contentful Paint (LCP):** No JS blocking the main thread means faster paint.
- **Interaction to Next Paint (INP):** Only the solver island hydrates; no global hydration.
- **Cumulative Layout Shift (CLS):** Static HTML means predictable layout.

**Implementation:**
- No global state management (no Redux, no Zustand).
- No client-side routing library.
- No animation libraries on the page shell (CSS transitions only).
- Analytics is a tiny inline script, not a library.

---

## Decision 9: Analytics as a Service Wrapper (Not a Library)

**Context:** Need to track searches, zero-results, copy actions, etc., without heavy scripts like Google Analytics or Mixpanel.

**Decision:** Build a lightweight analytics service (`src/services/analytics.ts`) that sends beacon events to a JSON endpoint or logs to console in V1.

**Rationale:**
- **Minimal JS:** No 50KB analytics library. Our wrapper is <1KB.
- **Privacy-first:** No cookies, no fingerprinting, no third-party scripts.
- **Meaningful events only:** Search, search duration, zero-result, copy action, dictionary load failure.
- **Extensible:** Easy to swap the backend later (Google Analytics 4, Plausible, etc.).

**Trade-offs:**
- No real-time dashboards in V1. Mitigation: Console logging + batch beacon sends.
- No user segmentation. Mitigation: Not needed for V1 SEO optimization.

---

## Decision 10: Semantic HTML + ARIA First

**Context:** Accessibility is a first-class requirement (95+ Lighthouse Accessibility).

**Decision:** All components use semantic HTML with proper ARIA labels, roles, and keyboard navigation. No `div` soup.

**Rationale:**
- **Screen readers:** Semantic HTML is automatically accessible. ARIA only enhances where native semantics fall short.
- **Keyboard navigation:** The solver must be fully operable with Tab, Enter, Escape, and arrow keys.
- **Focus management:** Visible focus rings, logical tab order, no focus traps.

---

## Future Decisions (Deferred)

| Decision | Deferred Until | Reason |
|---|---|---|
| Multiple dictionaries (Scrabble, SOWPODS, WWF) | V2 | Architecture supports it via `Dictionary` interface |
| Wildcards in search | V2 | Solver engine supports regex signatures |
| i18n / internationalization | V2 | No organic traffic in non-English yet |
| API endpoints | V2 | No external consumers yet |
| Browser extension | V3 | Requires separate build pipeline |
| User accounts / history | V3 | No retention problem to solve yet |
| Premium / subscription | V3 | Traffic first, monetization second |

---

*Last updated: June 2025*
*Owner: WordForge Engineering Team*
