import { allSeries, img } from '@/lib/data';
import SearchClient from './SearchClient';

export const metadata = { title: 'البحث المتقدم' };

export default function AdvancedSearchPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  void searchParams;
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

  return <SearchClient index={index} />;
}
