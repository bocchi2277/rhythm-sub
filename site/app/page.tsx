import Link from 'next/link';
import { latestReleases, currentProjects, allSeries, img } from '@/lib/data';
import AnimeCard from '@/components/AnimeCard';
import LatestEpisodes from '@/components/LatestEpisodes';
import HeroSlider, { type HeroSlide } from '@/components/HeroSlider';
import type { EpisodeCardItem } from '@/components/EpisodeCard';

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
  const heroSlides: HeroSlide[] = allSeries
    .filter((s) => s.cover && s.synopsis)
    .sort(() => Math.random() - 0.5)
    .slice(0, 12)
    .map((s) => ({
      slug: s.slug,
      title: s.title,
      cover: img(s.cover),
      synopsis: s.synopsis,
      genres: s.genres,
      rating: s.rating,
      type: s.type?.text ?? '',
      status: /completed/i.test(s.status ?? '') ? 'مكتمل' : 'مستمر'
    }));
  const recent = latestReleases;
  const topRated = [...allSeries]
    .filter((s) => s.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10);
  const ongoingList = currentProjects.slice(0, 12);

  return (
    <div className="max-w-7xl mx-auto px-4">
      <HeroSlider slides={heroSlides} />

      <section id="latest" className="mt-10 scroll-mt-24">
        <SectionTitle title="آخر الحلقات" />
        <LatestEpisodes
          items={
            recent.map(({ series, ep }): EpisodeCardItem => {
              /* Pick a unique per-episode image: prefer contentImages (episode screenshots)
                 over the shared series cover to avoid duplicate images in the grid */
              const validContentImg = ep.contentImages?.find(
                (u) => u && !/icons8|download-from-cloud/i.test(u) && !/\.svg$/i.test(u)
              );
              return {
                slug: series.slug,
                title: series.title,
                label: ep.label || series.title,
                image: img(validContentImg ?? ep.cardImage ?? ep.cover),
                badge: ep.displayNum ? (/^\d+$/.test(ep.displayNum) ? `الحلقة ${ep.displayNum}` : ep.displayNum) : null,
                date: ep.date,
              };
            })
          }
        />
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

      <section className="mt-14 max-w-4xl mx-auto grid sm:grid-cols-2 gap-6 fade-up">
        <a
          href="https://www.paypal.me/shahabalbalushi1995"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl overflow-hidden aspect-[2/1] border border-edge hover:border-accent/50 transition-colors [&:hover>img]:scale-[1.02]"
          aria-label="كن راعيًا لنا"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banners/sponsor.jpg" alt="كن راعيًا لنا" loading="lazy" className="w-full h-full object-cover transition-transform duration-300" />
        </a>
        <Link href="/support/" className="block rounded-2xl overflow-hidden aspect-[2/1] border border-edge hover:border-accent/50 transition-colors [&:hover>img]:scale-[1.02]" aria-label="الدعم الفني">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banners/tech-support.jpg" alt="الدعم الفني" loading="lazy" className="w-full h-full object-cover transition-transform duration-300" />
        </Link>
      </section>
    </div>
  );
}
