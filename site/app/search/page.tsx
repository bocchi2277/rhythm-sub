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
  return <SearchClient index={index} />;
}
