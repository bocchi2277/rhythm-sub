import Link from 'next/link';
import { latestReleases, img } from '@/lib/data';

export const metadata = { title: 'آخر الإصدارات' };

// Static export: ship the newest 100 releases (the full archive stays
// reachable through /advanced-search, sorted by recent). 1000+ rows would
// bloat this must-revalidate page for no benefit — the tail is years old.
const LIMIT = 100;

function formatDate(iso: string | null): string {
  if (!iso) return 'بدون تاريخ';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'بدون تاريخ';
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function LatestPage() {
  const items = latestReleases.slice(0, LIMIT);
  return (
    <div className="max-w-5xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-2">آخر الإصدارات</h1>
      <p className="text-muted text-sm mb-6">
        أحدث {items.length} إصداراً عبر كل السلاسل، مرتبة من الأحدث للأقدم.
      </p>

      {items.length === 0 ? (
        <p className="text-muted py-10 text-center">لا توجد إصدارات بعد.</p>
      ) : (
        <div className="space-y-3">
          {items.map(({ series, ep }) => (
            <Link
              key={`${series.slug}-${ep.slug}`}
              href={`/anime/${series.slug}/`}
              className="card-hover flex items-center gap-4 bg-card border border-edge rounded-2xl p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(ep.cover || series.cover)}
                alt=""
                width={64}
                height={90}
                loading="lazy"
                className="w-12 h-[68px] object-cover rounded-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm truncate">{ep.label}</p>
                <p className="text-muted text-xs mt-0.5 truncate">{series.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[11px] text-muted">{formatDate(ep.date)}</span>
                  {ep.qualities.slice(0, 3).map((q) => (
                    <span
                      key={q.quality}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-panel border border-edge text-muted"
                    >
                      {q.quality}
                    </span>
                  ))}
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center mt-8 mb-4">
        <Link href="/advanced-search/" className="text-accent hover:underline text-sm">
          تصفح كل الإصدارات بالبحث المتقدم ←
        </Link>
      </p>
    </div>
  );
}
