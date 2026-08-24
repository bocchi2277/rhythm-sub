'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function RandomClient({ slugs }: { slugs: string[] }) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || slugs.length === 0) return;
    fired.current = true;
    const slug = slugs[Math.floor(Math.random() * slugs.length)];
    router.replace(`/anime/${slug}/`);
  }, [router, slugs]);

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="animate-pulse text-5xl">🎲</div>
      <p className="mt-4 text-muted">نختار لك شيئاً مميزاً...</p>
    </div>
  );
}
