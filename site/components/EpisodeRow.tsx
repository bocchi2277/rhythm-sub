import Link from 'next/link';
import type { Episode } from '@/lib/data';

function fmtDate(iso: string | null) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export default function EpisodeRow({ ep }: { ep: Episode }) {
  const allLinks = ep.qualities.flatMap((q) => q.links);
  const qualityTag = ep.qualities[0]?.quality ?? '';

  return (
    <div className="bg-card border border-edge rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="btn-accent w-12 shrink-0 rounded-xl py-2 text-center">
          <span className="block text-[10px] opacity-80 leading-none mb-0.5">الحلقة</span>
          <span className="block font-bold text-base leading-none">{ep.displayNum ?? '★'}</span>
        </span>
        <div className="min-w-0">
          <Link href={`/anime/${ep.slug.replace(/-p\d+$/, '')}/`} className="block text-sm font-bold line-clamp-2 hover:text-accent transition-colors" dir="ltr">
            {ep.label || `الحلقة ${ep.displayNum}`}
          </Link>
          <p className="text-xs text-muted mt-1">{fmtDate(ep.date)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {allLinks.map((l, li) => {
          const isTorrent = /torrent|nyaa/i.test(l.name);
          return (
            <a
              key={li}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
                isTorrent ? 'border border-edge hover:border-accent' : 'btn-accent'
              }`}
            >
              {l.name}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
            </a>
          );
        })}
      </div>
      {qualityTag && <span className="hidden">{qualityTag}</span>}
    </div>
  );
}
