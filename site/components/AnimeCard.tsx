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

export function QualityRibbon({ label }: { label?: string }) {
  const m = label?.match(/\[(BD|WEB(?:-DL)?|DVD|HDTV)\b/i);
  if (!m) return null;
  return (
    <span className="absolute -start-8 top-3 rotate-[-45deg] w-32 text-center text-[10px] font-bold py-0.5 bg-accent-deep text-white shadow-lg">
      {m[1].toUpperCase()}
    </span>
  );
}

export default function AnimeCard({
  series,
  episodeBadge
}: {
  series: Pick<Series, 'slug' | 'title' | 'cover' | 'rating' | 'status' | 'type' | 'episodes'>;
  episodeBadge?: string;
}) {
  return (
    <Link
      href={`/anime/${series.slug}/`}
      className="card-hover group relative block bg-card rounded-2xl overflow-hidden border border-edge"
    >
      <StatusBadge status={series.status} />
      <div className="relative aspect-[2/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(series.cover)}
          alt={series.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        {episodeBadge && (
          <span className="absolute bottom-2 end-2 text-[11px] font-bold px-2 py-1 rounded-lg glass border border-edge">
            {episodeBadge}
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
      <h3 className="p-3 text-sm font-medium leading-snug line-clamp-2 group-hover:text-accent transition-colors">
        {series.title}
      </h3>
    </Link>
  );
}
