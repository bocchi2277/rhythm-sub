import Link from 'next/link';

export type EpisodeCardItem = {
  slug: string;
  title: string;
  label: string;
  image: string;
  badge: string | null;
  date: string | null;
};

export default function EpisodeCard({ item }: { item: EpisodeCardItem }) {
  return (
    <Link
      href={`/anime/${item.slug}/`}
      className="card-hover group relative block bg-card rounded-2xl overflow-hidden border border-edge"
    >
      <div className="relative aspect-video overflow-hidden bg-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.badge ? `${item.title} - ${item.badge}` : item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {item.badge && (
          <span className="absolute bottom-2 end-2 text-xs font-bold px-2.5 py-1 rounded-lg glass border border-edge">
            {item.badge}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 dir="ltr" className="text-sm font-medium line-clamp-1 text-left group-hover:text-accent transition-colors">
          {item.label || item.title}
        </h3>
        {item.date && (
          <p className="text-xs text-muted mt-1">
            {new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.date))}
          </p>
        )}
      </div>
    </Link>
  );
}
