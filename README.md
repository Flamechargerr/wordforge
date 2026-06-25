# WordForge

The fastest, cleanest word unscrambler on the internet. Built with Astro, Preact, and TypeScript.

## Features

- ⚡ **Sub-100ms solver** — Sorted-key algorithm, client-side only
- 🎯 **Scrabble scores** — Every result shows tile scores
- 📚 **370,000+ words** — Comprehensive dictionary
- 🔒 **Zero ads, zero tracking** — Privacy-first
- 📱 **Mobile-first** — Responsive, accessible design
- 🔍 **SEO-optimized** — 715+ indexable pages with schema markup

## Tech Stack

- [Astro](https://astro.build/) — Static site generation
- [Preact](https://preactjs.com/) — Islands architecture for interactivity
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first styling
- [TypeScript](https://www.typescriptlang.org/) — Strict type checking
- [Vitest](https://vitest.dev/) — Unit testing

## Project Structure

```
wordforge/
├── src/
│   ├── components/      # Preact islands (Solver)
│   ├── layouts/         # Astro layouts (Layout.astro)
│   ├── pages/          # Astro pages + pSEO routes
│   ├── lib/            # Pure TypeScript business logic
│   ├── services/       # Analytics, logging
│   ├── types/          # Shared TypeScript types
│   └── styles/         # Global CSS
├── public/             # Static assets
├── scripts/            # Dictionary build scripts
├── tests/              # Unit tests
├── DECISIONS.md        # Architecture decisions
└── PRD.md             # Product requirements
```

## Getting Started

```bash
# Install dependencies
npm install

# Build the dictionary (one-time)
npx tsx scripts/build-dictionary.ts

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

The project is configured for static output (`output: 'static'` in `astro.config.mjs`).

### Other Platforms

The `dist/` directory contains the static build. Upload it to any static hosting provider:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- AWS S3 + CloudFront

## Dictionary

The dictionary is built from the [english-words](https://github.com/dwyl/english-words) list and processed into:
- **Server dictionary** (359K words) — Used for pSEO page generation
- **Client dictionary** (75K words, 1.2MB) — Bundled with the solver island

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Lighthouse Performance | 95+ | ✅ Zero-JS by default |
| Lighthouse SEO | 100 | ✅ 715+ indexable pages |
| Lighthouse Accessibility | 95+ | ✅ ARIA labels, keyboard nav |
| LCP | < 1.5s | ✅ Static HTML |
| INP | < 100ms | ✅ Islands architecture |
| CLS | < 0.05 | ✅ No layout shifts |

## License

MIT
