import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allSeries, bySlug, img } from '@/lib/data';
import type { Episode } from '@/lib/data';
import AnimeCard from '@/components/AnimeCard';
import EpisodeRow from '@/components/EpisodeRow';

export function generateStaticParams() {
  return allSeries.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = bySlug(slug);
  return { title: s?.title ?? 'غير موجود' };
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function AnimePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = bySlug(slug);
  if (!s) notFound();

  const related = (s.relatedSeries ?? []).map((k) => allSeries.find((x) => x.key === k)).filter(Boolean);

  return (
    <div>
      <div className="relative">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-lg scale-110"
          style={{ backgroundImage: `url('${encodeURI(img(s.cover))}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/50" />
        <div className="relative max-w-7xl mx-auto px-4 pt-6 md:pt-8 pb-6 grid lg:grid-cols-[240px_1fr] gap-5 lg:gap-6 items-start fade-up">
          <div className="mx-auto md:mx-0 w-[150px] lg:w-[220px] aspect-[2/3] rounded-2xl overflow-hidden border border-edge shadow-[0_20px_50px_rgba(0,0,0,.55)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(s.cover)} alt={s.title} className="w-full h-full object-cover" />
          </div>
          <div className="text-center lg:text-start">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-3">
              {s.type?.text && (
                <span className="text-xs font-bold px-3 py-1 rounded-lg btn-accent">{s.type.text}</span>
              )}
              {s.status && (
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg border ${
                    /completed/i.test(s.status)
                      ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10'
                      : 'border-accent/40 text-accent bg-accent/10'
                  }`}
                >
                  {/completed/i.test(s.status) ? 'مكتمل' : 'مستمر'}
                </span>
              )}
              {s.rating != null && (
                <span className="text-xs font-bold px-3 py-1 rounded-lg border border-yellow-400/40 text-yellow-300 bg-yellow-400/10">
                  ★ {s.rating.toFixed(2)}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold leading-tight">{s.title}</h1>
            {s.altTitles && s.altTitles.length > 0 && (
              <p dir="ltr" className="mt-1.5 text-xs sm:text-sm text-muted line-clamp-1 lg:text-end">
                {s.altTitles.join(' • ')}
              </p>
            )}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 max-w-2xl lg:max-w-none w-fit mx-auto md:mx-0 text-sm">
              <Meta label="استوديو" value={s.studio} />
              <Meta label="سنة الإصدار" value={s.year} />
              <Meta label="الموسم" value={s.season?.text} />
              <Meta label="عدد الحلقات" value={s.episodesCount} />
            </div>
            {s.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-2">
                {s.genres.map((g) => (
                  <Link
                    key={g}
                    href={`/advanced-search/?genre=${encodeURIComponent(g)}`}
                    className="glass border border-edge hover:border-accent transition-colors text-xs px-3 py-1.5 rounded-lg"
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        <section>
          <h2 className="text-lg font-bold flex items-center gap-3 mb-4">
            <span className="w-1.5 h-5 rounded-full btn-accent block" />
            قائمة الحلقات والإصدارات ({s.episodes.length})
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {s.episodes.map((ep) => (
              <EpisodeRow key={`${ep.slug}-${ep.postId}`} ep={ep} typeText={s.type?.text} />
            ))}
          </div>
        </section>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {s.trailerYoutubeId && (
            <div className="rounded-2xl overflow-hidden border border-edge aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${s.trailerYoutubeId}`}
                title={`تريلر ${s.title}`}
                allowFullScreen
                loading="lazy"
                className="w-full h-full"
              />
            </div>
          )}
          {s.synopsis && (
            <div className="bg-card border border-edge rounded-2xl p-5">
              <h3 className="font-bold mb-3">مُلخَّص القصَّة</h3>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{s.synopsis}</p>
            </div>
          )}
          {Object.keys(s.staff).length > 0 && (
            <div className="bg-card border border-edge rounded-2xl p-5">
              <h3 className="font-bold mb-3 text-center lg:text-start">العاملون على المشروع</h3>
              <dl dir="ltr" className="text-sm text-left w-fit mx-auto lg:mx-0 lg:w-full">
                {Object.entries(s.staff).map(([role, names]) => (
                  <div key={role} className="flex flex-wrap gap-x-3 gap-y-1 py-2 border-b border-edge/50 last:border-0">
                    <dt className="text-accent shrink-0 font-medium min-w-[5.5rem]">{role}</dt>
                    <dd className="text-muted flex-1 min-w-0 break-words" dir="auto">{names.join('، ')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {related.length > 0 && (
            <div className="bg-card border border-edge rounded-2xl p-5">
              <h3 className="font-bold mb-3">مواضيع ذات صلة</h3>
              <div className="grid grid-cols-2 gap-3">
                {related.map(
                  (r) =>
                    r && (
                      <AnimeCard key={r.key} series={r} />
                    )
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
