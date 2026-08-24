import Link from 'next/link';
import type { Episode, Series } from '@/lib/data';
import { img } from '@/lib/data';

export default function EpisodeCard({
  series,
  ep
}: {
  series: Pick<Series, 'slug' | 'title'>;
  ep: Episode;
}) {
  return (
    <Link
      href={`/anime/${series.slug}/`}
      className="card-hover group relative block bg-card rounded-2xl overflow-hidden border border-edge"
    >
      <div className="relative aspect-video overflow-hidden bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(ep.cardImage ?? ep.cover)}
          alt={`${series.title}${ep.displayNum ? ` - ${ep.displayNum}` : ''}`}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {ep.displayNum && (
          <span className="absolute bottom-2 end-2 text-xs font-bold px-2.5 py-1 rounded-lg glass border border-edge">
            {/^\d+$/.test(ep.displayNum) ? `الحلقة ${ep.displayNum}` : `الحلقتان ${ep.displayNum}`}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 dir="ltr" className="text-sm font-medium line-clamp-1 text-left group-hover:text-accent transition-colors">
          {ep.label || series.title}
        </h3>
        {ep.date && (
          <p className="text-xs text-muted mt-1">
            {new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ep.date))}
          </p>
        )}
      </div>
    </Link>
  );
}
