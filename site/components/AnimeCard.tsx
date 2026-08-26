import Link from 'next/link';
import type { Series } from '@/lib/data';
import { img } from '@/lib/data';

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const done = /completed/i.test(status);
  return (
    <span
      className={`absolute top-2 start-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-md glass border ${
        done ? 'border-emerald-400/40 text-emerald-300' : 'border-accent/50 text-accent'
      }`}
    >
      {done ? 'مكتمل' : 'مستمر'}
    </span>
  );
}

export default function AnimeCard({
  series,
  imageOverride,
  badge
}: {
  series: Pick<Series, 'slug' | 'title' | 'cover' | 'rating' | 'status' | 'type' | 'episodes'>;
  imageOverride?: string | null;
  badge?: string;
}) {
  const src = img(imageOverride ?? series.cover);
  const noImage = !imageOverride && !series.cover;
  return (
    <Link
      href={`/anime/${series.slug}/`}
      className="card-hover group relative block bg-card rounded-2xl overflow-hidden border border-edge"
    >
      <StatusBadge status={series.status} />
      <div className="relative aspect-[2/3] overflow-hidden bg-panel">
        {noImage ? (
          <div className="w-full h-full grid place-items-center p-3 bg-gradient-to-br from-panel to-bg text-center">
            <span dir="ltr" className="text-xs font-bold text-muted line-clamp-4">{series.title}</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={badge ? `${series.title} - ${badge}` : series.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        {badge && (
          <span className="absolute bottom-2 end-2 text-[11px] font-bold px-2 py-1 rounded-lg glass border border-edge">
            {badge}
          </span>
        )}
        {series.rating != null && (
          <span className="absolute bottom-2 start-2 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg glass border border-edge">
            <svg width="11" height="11" viewBox="0 0 24 24" className="fill-yellow-400">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
            </svg>
            {series.rating.toFixed(2)}
          </span>
        )}
        {series.type?.text && (
          <span className="absolute top-2 end-2 text-[10px] font-bold px-2 py-0.5 rounded-md glass border border-edge">
            {series.type.text}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3
          dir="ltr"
          className="clamp-2-hard text-sm font-medium leading-snug text-left group-hover:text-accent transition-colors"
          title={series.title}
        >
          {series.title}
        </h3>
      </div>
    </Link>
  );
}
