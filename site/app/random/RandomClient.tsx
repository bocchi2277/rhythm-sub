'use client';

import { useEffect, useRef } from 'react';

export default function RandomClient({ slugs }: { slugs: string[] }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || slugs.length === 0) return;
    fired.current = true;
    const slug = slugs[Math.floor(Math.random() * slugs.length)];
    window.location.replace(`/anime/${slug}/`);
  }, [slugs]);

  if (slugs.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-muted">لا توجد أعمال متاحة حالياً.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="animate-pulse text-5xl" aria-hidden="true">🎲</div>
      <h1 className="mt-4 text-muted text-base font-normal">نختار لك شيئاً مميزاً...</h1>
    </div>
  );
}
