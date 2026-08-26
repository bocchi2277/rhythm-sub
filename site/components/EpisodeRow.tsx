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

function formatQualityBadge(rawQuality: string): { isBD: boolean; label: string } {
  const clean = rawQuality.replace(/\[[0-9A-Fa-f]{6,12}\]/g, '').trim();
  const isBD = /\bbd\b|blu-ray|bluray/i.test(clean);
  const resMatch = clean.match(/(\d{3,4}p)/i);
  const res = resMatch ? resMatch[1] : (/hevc/i.test(clean) ? '1080p' : '');

  let label = '';
  if (isBD) {
    label = res ? `BD ${res}` : 'BD';
  } else if (res) {
    label = /\bweb\b/i.test(clean) ? `WEB ${res}` : res;
  } else if (clean && clean.length <= 15) {
    label = clean;
  }
  return { isBD, label };
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

  // Filter out any empty quality rows
  const validQualities = ep.qualities.filter((q) => q.links && q.links.length > 0);

  return (
    <div className="bg-card border border-edge rounded-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
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

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {validQualities.map((q, qi) => {
          const { isBD, label } = formatQualityBadge(q.quality);
          return (
            <div
              key={qi}
              className="flex items-center gap-1.5 bg-panel/70 border border-edge rounded-xl px-2 py-1"
            >
              {label && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isBD
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-edge text-muted'
                  }`}
                >
                  {label}
                </span>
              )}
              {q.links.map((l, li) => {
                const isTorrent = /torrent|nyaa/i.test(l.name);
                return (
                  <a
                    key={li}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                      isTorrent ? 'bg-card border border-edge hover:border-accent' : 'btn-accent'
                    }`}
                  >
                    {l.name}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                    </svg>
                  </a>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
