import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allSeries, bySlug, img } from '@/lib/data';
import type { Episode } from '@/lib/data';

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

function DownloadRow({ ep }: { ep: Episode }) {
  return (
    <details className="group bg-panel border border-edge rounded-2xl overflow-hidden open:border-accent/40 transition-colors">
      <summary className="flex items-center gap-3 p-4 cursor-pointer select-none list-none hover:bg-card transition-colors">
        <span className="btn-accent w-11 h-11 rounded-xl grid place-items-center font-bold text-lg shrink-0">
          {ep.number ?? '★'}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold truncate">{ep.label || `الحلقة ${ep.number}`}</h4>
          <p className="text-xs text-muted mt-0.5">{fmtDate(ep.date)}</p>
        </div>
        {ep.qualities.length > 0 && (
          <span className="hidden sm:inline-block text-xs font-bold text-accent border border-accent/40 bg-accent/10 px-3 py-1.5 rounded-lg">
            تحميل ({ep.qualities.reduce((n, q) => n + q.links.length, 0)} روابط)
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 text-muted group-open:rotate-180 transition-transform"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="px-4 pb-4 space-y-3">
        {ep.synopsis && ep.qualities.length === 0 && (
          <p className="text-sm text-muted leading-relaxed border-t border-edge pt-3">{ep.synopsis}</p>
        )}
        {ep.qualities.map((q, qi) => (
          <div key={qi} className="border-t border-edge pt-3 first:border-0 first:pt-0">
            <p className="text-xs font-bold text-muted mb-2">{q.quality}</p>
            <div className="flex flex-wrap gap-2">
              {q.links.map((l, li) => {
                const isTorrent = /torrent|nyaa/i.test(l.name);
                return (
                  <a
                    key={li}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                      isTorrent ? 'border border-edge hover:border-accent' : 'btn-accent'
                    }`}
                  >
                    {isTorrent ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                      </svg>
                    )}
                    {l.name}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
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
        <div className="relative max-w-7xl mx-auto px-4 pt-8 pb-6 grid md:grid-cols-[240px_1fr] gap-6 items-start fade-up">
          <div className="mx-auto md:mx-0 w-[220px] aspect-[2/3] rounded-2xl overflow-hidden border border-edge shadow-[0_20px_50px_rgba(0,0,0,.55)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(s.cover)} alt={s.title} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
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
            <h1 className="text-2xl md:text-4xl font-bold leading-tight">{s.title}</h1>
            {s.altTitles && s.altTitles.length > 0 && (
              <p dir="ltr" className="mt-1.5 text-sm text-muted text-end line-clamp-1">
                {s.altTitles.join(' • ')}
              </p>
            )}
            <div className="mt-4 grid sm:grid-cols-2 gap-x-8 gap-y-2 max-w-2xl">
              <Meta label="استوديو" value={s.studio} />
              <Meta label="سنة الإصدار" value={s.year} />
              <Meta label="الموسم" value={s.season?.text} />
              <Meta label="عدد الحلقات" value={s.episodesCount} />
            </div>
            {s.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
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
          <div className="space-y-3">
            {[...s.episodes].reverse().map((ep) => (
              <DownloadRow key={`${ep.slug}-${ep.postId}`} ep={ep} />
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
              <h3 className="font-bold mb-3">قصة الأنمي</h3>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{s.synopsis}</p>
            </div>
          )}
          {Object.keys(s.staff).length > 0 && (
            <div className="bg-card border border-edge rounded-2xl p-5">
              <h3 className="font-bold mb-3">العاملون على المشروع</h3>
              <dl dir="ltr" className="space-y-1.5 text-sm text-left">
                {Object.entries(s.staff).map(([role, names]) => (
                  <div key={role} className="flex gap-3">
                    <dt className="text-accent shrink-0 w-24 font-medium">{role}</dt>
                    <dd className="text-muted" dir="auto">{names.join('، ')}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {related.length > 0 && (
            <div className="bg-card border border-edge rounded-2xl p-5">
              <h3 className="font-bold mb-3">أعمال ذات صلة</h3>
              <div className="space-y-2">
                {related.map(
                  (r) =>
                    r && (
                      <Link key={r.key} href={`/anime/${r.slug}/`} className="block text-sm hover:text-accent transition-colors">
                        ← {r.title}
                      </Link>
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
