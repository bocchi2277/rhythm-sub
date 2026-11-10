import { Suspense } from 'react';
import { allSeries, img } from '@/lib/data';
import SearchClient from './SearchClient';

export const metadata = { title: 'البحث المتقدم' };

export default function AdvancedSearchPage() {
  const index = allSeries.map((s) => ({
    slug: s.slug,
    title: s.title,
    alt: (s.altTitles ?? []).join(' '),
    cover: img(s.cover),
    genres: s.genres,
    type: s.type?.text ?? '',
    status: /completed/i.test(s.status ?? '') ? 'مكتمل' : 'مستمر',
    year: s.year,
    season: s.season?.text ?? '',
    rating: s.rating,
    episodesCount: s.episodes.length,
    lastReleaseAt: s.lastReleaseAt
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      {/* h1 lives in the server component: the Suspense boundary around
          useSearchParams opts its content out of SSG, so an h1 inside it is
          absent from the static HTML entirely (SEO + a11y + no-JS). */}
      <h1 className="text-2xl font-bold mb-6">البحث المتقدم</h1>
      <Suspense fallback={<p className="text-muted text-sm">جاري تحميل البحث…</p>}>
        <SearchClient index={index} />
      </Suspense>
    </div>
  );
}
