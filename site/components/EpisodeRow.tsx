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

const TYPE_BADGE: Record<string, string> = {
  movie: 'فيلم',
  ova: 'OVA',
  ona: 'ONA',
  special: 'خاص',
  tv: '★',
};

/** Extract a short quality tag from the raw quality string */
function qualityTag(raw: string): { isBD: boolean; res: string } {
  const clean = raw.replace(/\[[0-9A-Fa-f]{6,12}\]/g, '').trim();
  const isBD = /\bbd\b|blu-ray|bluray/i.test(clean);
  const resMatch = clean.match(/(\d{3,4}p)/i);
  const res = resMatch ? resMatch[1] : '';
  return { isBD, res };
}

export default function EpisodeRow({ ep, typeText }: { ep: Episode; typeText?: string | null }) {
  const kindLabel =
    /movie|فيلم/i.test(ep.label)
      ? 'فيلم'
      : /\bova\b/i.test(ep.label)
        ? 'OVA'
        : /\bona\b/i.test(ep.label)
          ? 'ONA'
          : /special|خاص|\bsp\b/i.test(ep.label)
            ? 'خاص'
            : TYPE_BADGE[(typeText ?? '').toLowerCase()] ?? '★';
  const badgeText = ep.displayNum ?? kindLabel;
  const displayTitle = ep.label?.trim() || (ep.displayNum ? `الحلقة ${ep.displayNum}` : 'إصدار');

  /* Flatten all download links from all qualities into a single list,
     each tagged with its source info */
  const allLinks: { name: string; url: string; isBD: boolean; res: string }[] = [];
  for (const q of ep.qualities) {
    if (!q.links || q.links.length === 0) continue;
    const { isBD, res } = qualityTag(q.quality);
    for (const l of q.links) {
      allLinks.push({ name: l.name, url: l.url, isBD, res });
    }
  }

  return (
    <div className="bg-card border border-edge rounded-2xl p-3.5 hover:border-accent/40 transition-colors">
      {/* Top row: episode number badge + title + date */}
      <div className="flex items-center gap-3 mb-3">
        <span className="btn-accent w-12 shrink-0 rounded-xl py-2 text-center">
          {ep.displayNum && (
            <span className="block text-[10px] opacity-80 leading-none mb-0.5">الحلقة</span>
          )}
          <span className={`block font-bold leading-none ${ep.displayNum ? 'text-base' : 'text-[11px]'}`}>{badgeText}</span>
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/anime/${ep.slug.replace(/-p\d+$/, '')}/`}
            className="block text-sm font-bold truncate hover:text-accent transition-colors"
            dir="ltr"
            title={displayTitle}
          >
            {displayTitle}
          </Link>
          <p className="text-xs text-muted mt-0.5">{fmtDate(ep.date)}</p>
        </div>
      </div>

      {/* Download links: simple wrapped row */}
      {allLinks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allLinks.map((l, i) => {
            const isTorrent = /torrent|nyaa/i.test(l.name);
            const tag = l.isBD ? (l.res ? `BD ${l.res}` : 'BD') : l.res || '';
            return (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${
                  isTorrent
                    ? 'bg-card border border-edge hover:border-accent'
                    : l.isBD
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                      : 'btn-accent'
                }`}
                title={tag ? `${l.name} — ${tag}` : l.name}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
                {l.name}
                {tag && <span className="opacity-60 text-[9px]">{tag}</span>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
