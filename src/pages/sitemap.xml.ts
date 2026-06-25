import type { APIRoute } from 'astro';
import { TOP_WORDS } from '../lib/top-words';

export const GET: APIRoute = async () => {
  const baseUrl = 'https://wordforge.app';
  
  // Core pages
  const routes = [
    '',
    '/about/',
    '/contact/',
    '/privacy/',
    '/terms/',
    '/dmca/',
  ];
  
  // Unscramble pages (top 500 words)
  const unscrambleRoutes = TOP_WORDS.slice(0, 500).map(word => `/unscramble/${word}/`);
  
  // Words starting with pages
  const letterRoutes = 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => `/words-starting-with/${l}/`);
  
  // Letter-words pages (2-8 letters, 26 letters)
  const nLetterRoutes: string[] = [];
  for (let n = 2; n <= 8; n++) {
    for (const l of 'abcdefghijklmnopqrstuvwxyz') {
      nLetterRoutes.push(`/letter-words/${n}/${l}/`);
    }
  }
  
  const allUrls = [...routes, ...unscrambleRoutes, ...letterRoutes, ...nLetterRoutes];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${url === '' ? '1.0' : url.startsWith('/unscramble/') ? '0.8' : '0.6'}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
};
