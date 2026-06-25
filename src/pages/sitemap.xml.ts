import type { APIRoute } from 'astro';
import { TOP_WORDS } from '../lib/top-words';
import { SITE_URL } from '../config';

/** Common suffixes for words-ending-with pages */
const SUFFIXES = [
  'ing', 'tion', 'ed', 'er', 'ly', 'ness', 'ment', 'able', 'ous', 'ive',
  'al', 'ful', 'less', 'ist', 'ize', 'ise', 'ish', 'ism', 'ity', 'ant',
  'ent', 'ate', 'ure', 'age', 'ary', 'ory',
];

const today = new Date().toISOString().split('T')[0];

export const GET: APIRoute = async () => {
  const baseUrl = SITE_URL;
  
  // Core pages (highest priority)
  const coreRoutes = [
    { url: '', priority: '1.0', changefreq: 'daily' },
    { url: '/anagram-solver/', priority: '0.9', changefreq: 'weekly' },
    { url: '/wordle-solver/', priority: '0.9', changefreq: 'weekly' },
    { url: '/word-descrambler/', priority: '0.8', changefreq: 'weekly' },
    { url: '/word-scramble/', priority: '0.8', changefreq: 'weekly' },
    { url: '/about/', priority: '0.5', changefreq: 'monthly' },
    { url: '/contact/', priority: '0.3', changefreq: 'monthly' },
    { url: '/privacy/', priority: '0.3', changefreq: 'monthly' },
    { url: '/terms/', priority: '0.3', changefreq: 'monthly' },
    { url: '/dmca/', priority: '0.3', changefreq: 'monthly' },
  ];
  
  // Blog pages
  const blogRoutes = [
    '/blog/',
    '/blog/how-to-unscramble-words/',
    '/blog/highest-scoring-scrabble-words/',
    '/blog/scrabble-strategy-guide/',
    '/blog/two-letter-scrabble-words/',
    '/blog/wordle-strategy/',
    '/blog/words-with-friends-tips/',
  ].map(url => ({ url, priority: '0.7', changefreq: 'monthly' as const }));
  
  // Unscramble pages (top 500 words)
  const unscrambleRoutes = TOP_WORDS.slice(0, 500).map(word => ({
    url: `/unscramble/${word}/`,
    priority: '0.8',
    changefreq: 'weekly' as const,
  }));
  
  // Words starting with pages (A-Z)
  const letterRoutes = 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => ({
    url: `/words-starting-with/${l}/`,
    priority: '0.7',
    changefreq: 'weekly' as const,
  }));
  
  // Words ending with pages (suffixes)
  const suffixRoutes = SUFFIXES.map(s => ({
    url: `/words-ending-with/${s}/`,
    priority: '0.7',
    changefreq: 'weekly' as const,
  }));
  
  // Words with letter pages (A-Z)
  const wordsWithRoutes = 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => ({
    url: `/words-with/${l}/`,
    priority: '0.7',
    changefreq: 'weekly' as const,
  }));
  
  // Letter-words pages (2-8 letters, 26 letters)
  const nLetterRoutes: { url: string; priority: string; changefreq: string }[] = [];
  for (let n = 2; n <= 8; n++) {
    for (const l of 'abcdefghijklmnopqrstuvwxyz') {
      nLetterRoutes.push({
        url: `/letter-words/${n}/${l}/`,
        priority: '0.6',
        changefreq: 'weekly',
      });
    }
  }
  
  const allRoutes = [
    ...coreRoutes,
    ...blogRoutes,
    ...unscrambleRoutes,
    ...letterRoutes,
    ...suffixRoutes,
    ...wordsWithRoutes,
    ...nLetterRoutes,
  ];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(route => `  <url>
    <loc>${baseUrl}${route.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
