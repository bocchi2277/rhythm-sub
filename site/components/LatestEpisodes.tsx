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

  const nums: (number | '«' | '‹')[] = ['«', '‹', ...Array.from({ length: totalPages }, (_, i) => i + 1)];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {slice.map((item, i) => (
          <EpisodeCard key={`${item.slug}-${i}`} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {nums.map((n) => {
              if (typeof n !== 'number') {
                const target = n === '«' ? 1 : Math.max(1, current - 1);
                const disabled = current === 1;
                return (
                  <button
                    key={n}
                    onClick={() => !disabled && go(target)}
                    disabled={disabled}
                    className="w-10 h-10 rounded-full grid place-items-center text-sm font-bold bg-card border border-edge hover:border-accent transition-colors disabled:opacity-40"
                    aria-label={n === '«' ? 'الأولى' : 'السابقة'}
                  >
                    {n}
                  </button>
                );
              }
              return (
                <button
                  key={n}
                  onClick={() => go(n)}
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
        </div>
      )}
    </div>
  );
}
