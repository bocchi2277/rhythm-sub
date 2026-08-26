'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

type Item = { slug: string; title: string; alt: string; cover: string; year: number | null; type: string; status: string; rating: number | null };

function SearchInner({ index }: { index: Item[] }) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return index.filter(
      (i) => i.title.toLowerCase().includes(needle) || i.alt.toLowerCase().includes(needle) || i.slug.includes(needle.replace(/\s+/g, '-'))
    );
  }, [q, index]);

  return (
    <div className="max-w-4xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-5">البحث</h1>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="اكتب اسم الأنمي..."
        className="w-full bg-card border border-edge rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-accent transition-colors"
      />

      {q.trim() && (
        <p className="text-sm text-muted mt-4 mb-4">النتائج: {results.length}</p>
      )}

      <div className="space-y-2">
        {results.map((r) => (
          <Link
            key={r.slug}
            href={`/anime/${r.slug}/`}
            className="card-hover flex items-center gap-4 bg-card border border-edge rounded-2xl p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.cover} alt="" loading="lazy" className="w-12 h-16 object-cover rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 dir="ltr" className="text-sm font-bold text-right line-clamp-1">{r.title}</h3>
              <p className="text-xs text-muted mt-1">
                {[r.year, r.type, r.status].filter(Boolean).join(' • ')}
                {r.rating != null && <span className="text-yellow-400 font-bold"> • ★ {r.rating.toFixed(1)}</span>}
              </p>
            </div>
          </Link>
        ))}
        {q.trim() && results.length === 0 && (
          <p className="text-muted text-sm py-8 text-center">لا توجد نتائج مطابقة — جرّب البحث المتقدم بالفلاتر</p>
        )}
      </div>
    </div>
  );
}

export default function SearchClient({ index }: { index: Item[] }) {
  return (
    <Suspense fallback={null}>
      <SearchInner index={index} />
    </Suspense>
  );
}
