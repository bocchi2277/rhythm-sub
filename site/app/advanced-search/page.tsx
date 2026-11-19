import { Suspense } from 'react';
import SearchClient from './SearchClient';
import searchIndex from '@/search-index-manifest.json';

export const metadata = { title: 'البحث المتقدم' };

export default function AdvancedSearchPage() {
  // The index ships as an immutable content-hashed JSON (public/search-index/)
  // shared with /search — not inlined into this must-revalidate page.
  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      {/* h1 lives in the server component: the Suspense boundary around
          useSearchParams opts its content out of SSG, so an h1 inside it is
          absent from the static HTML entirely (SEO + a11y + no-JS). */}
      <h1 className="text-2xl font-bold mb-6">البحث المتقدم</h1>
      <Suspense fallback={<p className="text-muted text-sm">جاري تحميل البحث…</p>}>
        <SearchClient indexUrl={searchIndex.url} />
      </Suspense>
    </div>
  );
}
