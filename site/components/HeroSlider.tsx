'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

export type HeroSlide = {
  slug: string;
  title: string;
  cover: string;
  synopsis: string;
  genres: string[];
  rating: number | null;
  type: string;
  status: string;
};

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => setIdx((i) => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    timer.current = setInterval(next, 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [next]);

  function manual(fn: () => void) {
    if (timer.current) clearInterval(timer.current);
    fn();
    timer.current = setInterval(next, 6000);
  }

  if (!slides.length) return null;
  const s = slides[idx];

  return (
    <section className="relative mt-6 rounded-3xl overflow-hidden border border-edge fade-up min-h-[340px]">
      <div
        key={s.slug}
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-lg scale-110 transition-all duration-700"
        style={{ backgroundImage: `url('${encodeURI(s.cover)}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />

      <div className="relative p-6 pb-14 md:p-10 md:pb-12 grid md:grid-cols-[200px_1fr] gap-6 items-end min-h-[360px]">
        <div className="hidden md:block relative w-[200px] aspect-[2/3] rounded-2xl overflow-hidden border border-edge shadow-[0_20px_50px_rgba(0,0,0,.6)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.cover} alt={s.title} className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
            {s.type && <span className="font-bold px-2.5 py-1 rounded-lg btn-accent">{s.type}</span>}
            <span
              className={`font-bold px-2.5 py-1 rounded-lg border ${
                /completed/i.test(s.status)
                  ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10'
                  : 'border-accent/40 text-accent bg-accent/10'
              }`}
            >
              {/completed/i.test(s.status) ? 'مكتمل' : 'مستمر'}
            </span>
            {s.rating != null && (
              <span className="glass border border-yellow-400/40 text-yellow-300 px-2.5 py-1 rounded-lg font-bold">
                ★ {s.rating.toFixed(2)}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-4xl font-bold leading-tight">{s.title}</h1>
          <p className="mt-3 text-muted text-sm leading-relaxed line-clamp-2 max-w-2xl">{s.synopsis}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {s.genres.slice(0, 4).map((g) => (
              <span key={g} className="glass border border-edge px-3 py-1.5 rounded-lg">
                {g}
              </span>
            ))}
          </div>
          <Link href={`/anime/${s.slug}/`} className="btn-accent inline-block mt-5 px-6 py-3 rounded-xl text-sm font-bold">
            صفحة الأنمي والتحميل
          </Link>
        </div>
      </div>

      {/* Desktop Prev / Next Buttons (Bottom Left) */}
      <div className="hidden md:flex absolute bottom-6 left-6 items-center gap-2 z-10">
        <button
          onClick={() => manual(prev)}
          aria-label="السابق"
          className="w-10 h-10 rounded-full glass border border-edge grid place-items-center hover:border-accent hover:text-accent transition-all hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => manual(next)}
          aria-label="التالي"
          className="w-10 h-10 rounded-full glass border border-edge grid place-items-center hover:border-accent hover:text-accent transition-all hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Centered Pagination Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => manual(() => setIdx(i))}
            aria-label={`شريحة ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === idx ? 'w-6 bg-accent' : 'w-1.5 bg-muted/40 hover:bg-muted'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
