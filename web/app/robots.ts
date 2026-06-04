import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/auth/', '/ja/success', '/en/success'],
    },
    sitemap: 'https://notion-manual-maker.vercel.app/sitemap.xml',
  };
}
