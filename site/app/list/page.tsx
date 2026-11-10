import Link from 'next/link';
import { allSeries } from '@/lib/data';
import AnimeCard from '@/components/AnimeCard';

export const metadata = { title: 'قائمة [A-Z]' };

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function letterOf(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  if (/[A-Z]/.test(c)) return c;
  if (AR_DIGITS.includes(c) || /[0-9]/.test(c)) return '0-9';
  return '#';
}

// '#' and '0-9' are not valid in URL fragments without encoding; map them
// to fragment-safe ids ('hash' / '09') so the anchor actually scrolls.
function anchorId(l: string): string {
  if (l === '#') return 'hash';
  if (l === '0-9') return '09';
  return l;
}

const ORDER: string[] = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '0-9', '#'];

export default function ListPage() {
  const groups = new Map<string, typeof allSeries>();
  for (const s of allSeries) {
    const l = letterOf(s.title);
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(s);
  }

  const present = ORDER.filter((l) => groups.has(l));

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <h1 className="text-2xl font-bold mb-6">قائمة [A-Z]</h1>

      <nav className="sticky top-[68px] z-30 glass border border-edge rounded-2xl p-2 flex flex-wrap gap-1 mb-8">
        {present.map((l) => (
          <a key={l} href={`#L-${anchorId(l)}`} className="w-9 h-9 grid place-items-center rounded-lg text-sm font-bold hover:bg-card hover:text-accent transition-colors">
            {l}
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        {present.map((l) => (
          <section key={l}>
            <h2 id={`L-${anchorId(l)}`} className="text-xl font-bold mb-5 scroll-mt-32 flex items-center gap-3">
              <span className="btn-accent w-9 h-9 rounded-xl grid place-items-center text-sm">{l}</span>
              <span className="text-muted text-sm font-normal">({groups.get(l)!.length})</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {groups
                .get(l)!
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((s) => (
                  <AnimeCard key={s.key} series={s} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
