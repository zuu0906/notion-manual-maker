import type { MetadataRoute } from 'next';

const BASE = 'https://chrome-manual-maker.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/pricing`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/how-it-works`,  lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
