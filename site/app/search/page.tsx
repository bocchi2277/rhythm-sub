import { allSeries, img } from '@/lib/data';
import SearchClient from './SearchClient';

export const metadata = { title: 'البحث' };

export default function SearchPage() {
  const index = allSeries.map((s) => ({
    slug: s.slug,
    title: s.title,
    alt: (s.altTitles ?? []).join(' '),
    cover: img(s.cover),
    year: s.year,
    type: s.type?.text ?? '',
    status: /completed/i.test(s.status ?? '') ? 'مكتمل' : 'مستمر',
    rating: s.rating
  }));
  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      {/* h1 in the server component: Suspense around useSearchParams opts its
          children out of SSG, so an h1 inside it is absent from the static HTML */}
      <h1 className="text-2xl font-bold mb-5">البحث</h1>
      <SearchClient index={index} />
    </div>
  );
}
