'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cssUrl } from '@/lib/css-url';

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
  // WCAG 2.2.2: auto-advancing content must be pausable. Hover/focus pause is
  // transient; the toggle button sets an explicit, sticky pause. Reduced-motion
  // users get no autoplay at all.
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const autoplay = !userPaused && !hoverPaused;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setUserPaused(true);
  }, []);

  const next = useCallback(
    () => {
      if (slides.length <= 1) return;
      setIdx((i) => (i + 1) % slides.length);
    },
    [slides.length]
  );
  const prev = useCallback(
    () => {
      if (slides.length <= 1) return;
      setIdx((i) => (i - 1 + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (slides.length <= 1 || !autoplay) return;
    timer.current = setInterval(next, 6000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [next, slides.length, autoplay]);

  function manual(fn: () => void) {
    if (timer.current) clearInterval(timer.current);
    fn();
    if (slides.length > 1 && autoplay) timer.current = setInterval(next, 6000);
  }

  if (!slides.length) return null;
  // Clamp: idx can exceed bounds if the slides prop ever shrinks between renders
  const s = slides[Math.min(idx, slides.length - 1)];

  return (
    <section
      className="relative mt-6 rounded-3xl overflow-hidden border border-edge fade-up min-h-[340px]"
      aria-roledescription="carousel"
      aria-label="أبرز الأعمال"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverPaused(false);
      }}
    >
      <div
        key={s.slug}
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-lg scale-110 transition-all duration-700"
        style={{ backgroundImage: `url('${cssUrl(s.cover)}')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/40" />

      <div className="relative p-6 pb-14 md:p-10 md:pb-12 grid md:grid-cols-[200px_1fr] gap-6 items-end min-h-[360px]">
        <div className="hidden md:block relative w-[200px] aspect-[2/3] rounded-2xl overflow-hidden border border-edge shadow-[0_20px_50px_rgba(0,0,0,.6)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.cover} alt={s.title} decoding="async" className="w-full h-full object-cover" />
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

      {/* Centered Pagination Dots + autoplay toggle (WCAG 2.2.2) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 items-center">
        <button
          onClick={() => setUserPaused((v) => !v)}
          aria-pressed={userPaused}
          aria-label={userPaused ? 'تشغيل العرض التلقائي' : 'إيقاف العرض التلقائي'}
          className="w-6 h-6 mr-1 rounded-full glass border border-edge grid place-items-center hover:border-accent hover:text-accent transition-colors"
        >
          {userPaused ? (
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M8 5v14l11-7z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          )}
        </button>
        {slides.map((slide, i) => (
          <button
            key={slide.slug}
            onClick={() => manual(() => setIdx(i))}
            aria-label={`شريحة ${i + 1}`}
            aria-current={i === idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === idx ? 'w-6 bg-accent' : 'w-1.5 bg-muted/40 hover:bg-muted'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
