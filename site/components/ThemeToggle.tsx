'use client';

import { useEffect, useState } from 'react';

/**
 * Dark/light toggle. The initial theme is applied before first paint by the
 * inline script in app/layout.tsx (CSP-hashed at build); this component only
 * reads the applied value on mount and flips it on click, persisting the
 * choice in localStorage('rhythm-theme'). No onclick= attributes anywhere —
 * the CSP sets script-src-attr 'none'; React synthetic events are fine.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('rhythm-theme', next);
    } catch {
      /* private mode / blocked storage — the toggle still works for this visit */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
      className="w-10 h-10 grid place-items-center rounded-xl border border-edge text-muted hover:text-accent hover:border-accent transition-colors shrink-0"
    >
      {theme === 'dark' ? (
        /* sun — shown in dark mode, click switches to light */
        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        /* moon — shown in light mode, click switches to dark */
        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
