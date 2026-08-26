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
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 mt-6 text-muted">جاري تحميل البحث...</div>}>
      <SearchClient index={index} />
    </Suspense>
  );
}
