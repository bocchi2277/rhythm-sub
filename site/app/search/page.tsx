import SearchClient from './SearchClient';
import searchIndex from '@/search-index-manifest.json';

export const metadata = { title: 'البحث' };

export default function SearchPage() {
  // Same immutable index as /advanced-search — one shared cache entry.
  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      {/* h1 in the server component: Suspense around useSearchParams opts its
          children out of SSG, so an h1 inside it is absent from the static HTML */}
      <h1 className="text-2xl font-bold mb-5">البحث</h1>
      <SearchClient indexUrl={searchIndex.url} />
    </div>
  );
}
