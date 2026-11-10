'use client';

import { useState } from 'react';
import EpisodeCard, { type EpisodeCardItem } from '@/components/EpisodeCard';

const PER_PAGE = 9;

export default function LatestEpisodes({ items }: { items: EpisodeCardItem[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const slice = items.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  function go(p: number) {
    setPage(p);
    document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  type Num = number | '«' | '‹' | '›' | '»' | '…';
  const nums: Num[] = ['«', '‹'];
  if (totalPages <= 6) {
    nums.push(...Array.from({ length: totalPages }, (_, i) => i + 1));
  } else {
    if (current <= 3) {
      nums.push(1, 2, 3, 4, '…', totalPages);
    } else if (current >= totalPages - 2) {
      nums.push('…', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      nums.push('…', current - 1, current, current + 1, '…', totalPages);
    }
  }
  // Forward controls (the old bar only had back/first — you could not
  // advance a page except by clicking a numbered button)
  if (totalPages > 1) nums.push('›', '»');

  return (
    <div>
      {items.length === 0 && <p className="text-muted text-sm py-8 text-center">لا توجد حلقات حديثة حالياً.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slice.map((item) => (
          <EpisodeCard key={`${item.slug}-${item.label}-${item.date ?? ''}`} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex flex-col items-center gap-3" aria-label="ترقيم صفحات الحلقات الأخيرة">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {nums.map((n, ni) => {
              if (n === '…') return <span key={`e${ni}`} className="px-1 text-muted" aria-hidden="true">…</span>;
              if (typeof n !== 'number') {
                const isLast = n === '»';
                const isFwd = n === '›' || isLast;
                const target = isFwd ? (isLast ? totalPages : Math.min(totalPages, current + 1)) : n === '«' ? 1 : Math.max(1, current - 1);
                const disabled = isFwd ? current === totalPages : current === 1;
                const label = n === '«' ? 'الأولى' : n === '‹' ? 'السابقة' : n === '›' ? 'التالية' : 'الأخيرة';
                return (
                  <button
                    key={n}
                    onClick={() => !disabled && go(target)}
                    disabled={disabled}
                    className="w-10 h-10 rounded-full grid place-items-center text-sm font-bold bg-card border border-edge hover:border-accent transition-colors disabled:opacity-40"
                    aria-label={label}
                  >
                    {n}
                  </button>
                );
              }
              return (
                <button
                  key={n}
                  onClick={() => go(n)}
                  aria-current={n === current ? 'page' : undefined}
                  className={`w-10 h-10 rounded-full grid place-items-center text-sm font-bold transition-colors ${
                    n === current ? 'btn-accent' : 'bg-card border border-edge hover:border-accent'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            صفحة {current} من {totalPages}
          </p>
        </nav>
      )}
    </div>
  );
}
