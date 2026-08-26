'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Item = {
  slug: string;
  title: string;
  alt: string;
  cover: string;
  genres: string[];
  type: string;
  status: string;
  year: number | null;
  season: string;
  rating: number | null;
  episodesCount: number | null;
  lastReleaseAt: string | null;
};

const SORTS = [
  { key: 'recent', label: 'الأحدث إصداراً' },
  { key: 'title_asc', label: 'الاسم أ-ي' },
  { key: 'title_desc', label: 'الاسم ي-أ' },
  { key: 'rating', label: 'الأعلى تقييماً' },
  { key: 'episodes', label: 'عدد الحلقات' },
  { key: 'year', label: 'سنة الإصدار' }
] as const;

type SortKey = (typeof SORTS)[number]['key'];

export default function SearchClient({ index }: { index: Item[] }) {
  const searchParams = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [type, setType] = useState(() => searchParams.get('type') ?? '');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [genre, setGenre] = useState(() => searchParams.get('genre') ?? '');
  const [sort, setSort] = useState<SortKey>(() => (searchParams.get('sort') as SortKey) || 'recent');

  // Sync state to URL params
  const updateUrl = useCallback((newParams: { q?: string; type?: string; status?: string; genre?: string; sort?: string }) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (newParams.q) url.searchParams.set('q', newParams.q);
    else url.searchParams.delete('q');

    if (newParams.type) url.searchParams.set('type', newParams.type);
    else url.searchParams.delete('type');

    if (newParams.status) url.searchParams.set('status', newParams.status);
    else url.searchParams.delete('status');

    if (newParams.genre) url.searchParams.set('genre', newParams.genre);
    else url.searchParams.delete('genre');

    if (newParams.sort && newParams.sort !== 'recent') url.searchParams.set('sort', newParams.sort);
    else url.searchParams.delete('sort');

    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
  }, []);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      setQ(sp.get('q') ?? '');
      setType(sp.get('type') ?? '');
      setStatus(sp.get('status') ?? '');
      setGenre(sp.get('genre') ?? '');
      setSort((sp.get('sort') as SortKey) || 'recent');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleQChange = (val: string) => {
    setQ(val);
    updateUrl({ q: val, type, status, genre, sort });
  };

  const handleTypeChange = (val: string) => {
    setType(val);
    updateUrl({ q, type: val, status, genre, sort });
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    updateUrl({ q, type, status: val, genre, sort });
  };

  const handleGenreChange = (val: string) => {
    setGenre(val);
    updateUrl({ q, type, status, genre: val, sort });
  };

  const handleSortChange = (val: SortKey) => {
    setSort(val);
    updateUrl({ q, type, status, genre, sort: val });
  };

  const types = useMemo(() => [...new Set(index.map((i) => i.type).filter(Boolean))].sort(), [index]);
  const genres = useMemo(
    () =>
      index
        .flatMap((i) => i.genres)
        .reduce<Record<string, number>>((a, g) => ((a[g] = (a[g] ?? 0) + 1), a), {}),
    [index]
  );
  const topGenres = useMemo(
    () => Object.entries(genres).sort((a, b) => b[1] - a[1]),
    [genres]
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = index.filter(
      (i) =>
        (!needle || i.title.toLowerCase().includes(needle) || i.alt.toLowerCase().includes(needle)) &&
        (!type || i.type === type) &&
        (!status || i.status === status) &&
        (!genre || i.genres.includes(genre))
    );
    out = [...out];
    switch (sort) {
      case 'title_asc':
        out.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        out.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'rating':
        out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case 'episodes':
        out.sort((a, b) => (b.episodesCount ?? 0) - (a.episodesCount ?? 0));
        break;
      case 'year':
        out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
        break;
      default:
        out.sort((a, b) => String(b.lastReleaseAt ?? '').localeCompare(String(a.lastReleaseAt ?? '')));
    }
    return out;
  }, [q, type, status, genre, sort, index]);

  const selectCls =
    'bg-card border border-edge rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors';

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-6">البحث المتقدم</h1>

      <div className="glass border border-edge rounded-2xl p-5 grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr] mb-3">
        <input
          value={q}
          onChange={(e) => handleQChange(e.target.value)}
          placeholder="ابحث بالاسم الإنجليزي أو الياباني..."
          className={selectCls + ' w-full'}
          dir="ltr"
        />
        <select value={type} onChange={(e) => handleTypeChange(e.target.value)} className={selectCls}>
          <option value="">كل الأنواع</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => handleStatusChange(e.target.value)} className={selectCls}>
          <option value="">الحالة</option>
          <option>مستمر</option>
          <option>مكتمل</option>
        </select>
        <select value={genre} onChange={(e) => handleGenreChange(e.target.value)} className={selectCls}>
          <option value="">كل التصنيفات</option>
          {topGenres.map(([g, n]) => (
            <option key={g} value={g}>
              {g} ({n})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-8 text-xs">
        <span className="text-muted">ترتيب:</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => handleSortChange(s.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              sort === s.key ? 'btn-accent' : 'bg-card border border-edge hover:border-accent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted mb-4">النتائج: {results.length}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {results.map((r) => (
          <Link
            key={r.slug}
            href={`/anime/${r.slug}/`}
            className="card-hover flex gap-3 bg-card border border-edge rounded-2xl p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.cover} alt="" loading="lazy" className="w-[72px] h-[104px] object-cover rounded-xl shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 dir="ltr" className="text-sm font-bold text-end line-clamp-2 leading-snug">
                {r.title}
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-muted">
                {r.year && <span className="border border-edge px-1.5 py-0.5 rounded">{r.year}</span>}
                {r.type && <span className="border border-edge px-1.5 py-0.5 rounded">{r.type}</span>}
                <span
                  className={`border px-1.5 py-0.5 rounded ${
                    r.status === 'مكتمل' ? 'border-emerald-400/40 text-emerald-300' : 'border-accent/40 text-accent'
                  }`}
                >
                  {r.status}
                </span>
                {r.rating != null && <span className="text-yellow-400 font-bold">★ {r.rating.toFixed(1)}</span>}
              </div>
              {r.season && <p className="mt-1 text-xs text-muted">{r.season}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
