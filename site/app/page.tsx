import Link from 'next/link';
import { latestReleases, currentProjects, allSeries, img } from '@/lib/data';
import AnimeCard from '@/components/AnimeCard';

function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl font-bold flex items-center gap-3">
        <span className="w-1.5 h-6 rounded-full btn-accent block" />
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm text-muted hover:text-accent transition-colors">
          عرض الكل ←
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const featured = latestReleases[0]?.series;
  const recent = latestReleases.slice(0, 30);
  const topRated = [...allSeries]
    .filter((s) => s.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10);
  const ongoingList = currentProjects.slice(0, 12);

  return (
    <div className="max-w-7xl mx-auto px-4">
      {featured && (
        <section className="relative mt-6 rounded-3xl overflow-hidden border border-edge fade-up">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-lg scale-110"
            style={{ backgroundImage: `url('${encodeURI(img(featured.cover))}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />
          <div className="relative p-6 md:p-10 grid md:grid-cols-[220px_1fr] gap-6 items-end min-h-[340px]">
            <div className="hidden md:block relative w-[200px] aspect-[2/3] rounded-2xl overflow-hidden border border-edge shadow-[0_20px_50px_rgba(0,0,0,.6)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img(featured.cover)} alt={featured.title} className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs font-bold text-accent border border-accent/40 bg-accent/10 px-2.5 py-1 rounded-lg">
                أحدث إصدار
              </span>
              <h1 className="mt-3 text-2xl md:text-4xl font-bold leading-tight">{featured.title}</h1>
              <p className="mt-3 text-muted text-sm leading-relaxed line-clamp-2 max-w-2xl">{featured.synopsis}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {featured.genres.slice(0, 4).map((g) => (
                  <span key={g} className="glass border border-edge px-3 py-1.5 rounded-lg">
                    {g}
                  </span>
                ))}
                {featured.rating != null && (
                  <span className="glass border border-yellow-400/40 text-yellow-300 px-3 py-1.5 rounded-lg font-bold">
                    ★ {featured.rating.toFixed(2)}
                  </span>
                )}
              </div>
              <Link
                href={`/anime/${featured.slug}/`}
                className="btn-accent inline-block mt-5 px-6 py-3 rounded-xl text-sm font-bold"
              >
                صفحة الأنمي والتحميل
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionTitle title="أحدث الإصدارات" href="/list/" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {recent.map(({ series, ep }, i) => (
            <AnimeCard
              key={`${ep.slug}-${i}`}
              series={series}
              imageOverride={ep.cardImage ?? ep.cover}
              badge={ep.number != null ? `الحلقة ${ep.number}` : ep.label || undefined}
            />
          ))}
        </div>
      </section>

      <section className="mt-12 grid lg:grid-cols-[1fr_300px] gap-8">
        <div>
          <SectionTitle title="مشاريعنا الحالية" />
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {ongoingList.map((s) => (
              <AnimeCard key={s.key} series={s} />
            ))}
          </div>
        </div>
        <aside>
          <SectionTitle title="الأعلى تقييماً" />
          <ol className="bg-card border border-edge rounded-2xl divide-y divide-edge overflow-hidden">
            {topRated.map((s, i) => (
              <li key={s.key}>
                <Link href={`/anime/${s.slug}/`} className="flex items-center gap-3 p-3 hover:bg-panel transition-colors">
                  <span
                    className={`w-7 h-7 shrink-0 grid place-items-center rounded-lg text-xs font-bold ${
                      i < 3 ? 'btn-accent' : 'bg-edge text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(s.cover)} alt="" className="w-9 h-12 object-cover rounded-md" loading="lazy" />
                  <span className="flex-1 text-xs font-medium line-clamp-2">{s.title}</span>
                  <span className="text-xs text-yellow-400 font-bold shrink-0">{(s.rating ?? 0).toFixed(1)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mt-14 glass border border-edge rounded-3xl p-8 text-center fade-up">
        <h2 className="text-2xl font-bold">تبحث عن أنمي معين؟</h2>
        <p className="text-muted mt-2 text-sm">تصفح مكتبتنا كاملة أو استخدم البحث المتقدم بالفلاتر</p>
        <div className="mt-5 flex justify-center gap-3 flex-wrap">
          <Link href="/list/" className="btn-accent px-6 py-3 rounded-xl text-sm font-bold">
            قائمة الأنمي
          </Link>
          <Link
            href="/advanced-search/"
            className="px-6 py-3 rounded-xl text-sm font-bold border border-edge hover:border-accent transition-colors"
          >
            بحث متقدم
          </Link>
        </div>
      </section>
    </div>
  );
}
