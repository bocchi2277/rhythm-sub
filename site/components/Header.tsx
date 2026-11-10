'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

const NAV = [
  { href: '/', label: 'الرئيسية' },
  { href: '/schedule', label: 'جدول الحلقات' },
  { href: '/advanced-search', label: 'البحث المتقدم' }
];

const LIST_LINKS = [
  { href: '/list', label: 'قائمة [A-Z]' },
  { href: '/series', label: 'السلاسل' }
];

const ABOUT_LINKS = [
  { href: '/about', label: 'من نحن' },
  { href: '/support', label: 'الدعم الفني' }
];

/**
 * Hover/focus/click dropdown. Previously reveal relied on `group-hover` CSS
 * only, so keyboard users got a focusable button that did nothing and the
 * menu links were `visibility:hidden` — unreachable by Tab entirely.
 */
function NavDropdown({ label, links }: { label: string; links: { href: string; label: string }[] }) {
  // open = pinned (click/tap/keyboard toggle) || transient hover/focus.
  // Blindly toggling on click made a touchscreen tap a no-op (synthetic
  // mouseenter opened, then click toggled it shut).
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const menuId = useId();
  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHovered(false);
          setPinned(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setPinned((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setPinned(false);
            setHovered(false);
          }
        }}
        className="px-3 py-2 rounded-lg hover:text-ink hover:bg-card transition-colors whitespace-nowrap flex items-center gap-1"
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        id={menuId}
        className={`absolute top-full start-0 pt-1 transition-opacity duration-200 ${
          open ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        <div className="glass border border-edge rounded-2xl p-1.5 min-w-[150px] shadow-2xl">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => {
                setPinned(false);
                setHovered(false);
              }}
              className="block px-3 py-2 rounded-xl text-sm hover:bg-card hover:text-accent focus-visible:bg-card focus-visible:text-accent outline-none transition-colors whitespace-nowrap"
            >
              {n.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Logo({ size = 'h-10' }: { size?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Rhythm-Sub">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon-192.png" alt="Rhythm-Sub" width={192} height={192} className={`${size} w-auto`} />
    </Link>
  );
}

function SearchForm({ className = '' }: { className?: string }) {
  return (
    <form action="/search/" method="GET" role="search" className={`relative ${className}`}>
      <input
        type="search"
        name="q"
        placeholder="ابحث عن أنمي..."
        aria-label="بحث"
        className="w-full bg-card border border-edge rounded-xl ps-9 pe-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />
      <button
        type="submit"
        aria-label="تنفيذ البحث"
        className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors grid place-items-center p-0.5"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
    </form>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="glass sticky top-0 z-50 border-b border-edge/70">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
        <Logo />
        <nav className="hidden lg:flex items-center gap-1 text-sm text-muted">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="px-3 py-2 rounded-lg hover:text-ink hover:bg-card transition-colors whitespace-nowrap">
              {n.label}
            </Link>
          ))}
          <NavDropdown label="قوائم أنمي" links={LIST_LINKS} />
          <NavDropdown label="عن الفريق" links={ABOUT_LINKS} />
          <Link href="/random" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-card transition-colors whitespace-nowrap">
            فاجئني 🎲
          </Link>
        </nav>
        <div className="ms-auto hidden lg:flex items-center gap-2 w-full max-w-[280px]">
          <SearchForm className="flex-1" />
          <a href="https://rhythm-sub.com/wp-login.php" className="btn-accent text-sm font-medium px-4 py-2 rounded-xl whitespace-nowrap">
            تسجيل الدخول
          </a>
        </div>
        <button
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="lg:hidden relative ms-auto w-10 h-10 grid place-items-center rounded-xl border border-edge hover:border-accent transition-colors shrink-0"
        >
          <span className="relative block w-5 h-5">
            <span
              className={`absolute inset-x-0 top-[3px] h-[2px] rounded bg-current transition-all duration-300 ${
                open ? 'top-1/2 -translate-y-1/2 rotate-45' : ''
              }`}
            />
            <span
              className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] rounded bg-current transition-all duration-200 ${
                open ? 'opacity-0 scale-x-0' : ''
              }`}
            />
            <span
              className={`absolute inset-x-0 bottom-[3px] h-[2px] rounded bg-current transition-all duration-300 ${
                open ? 'bottom-auto top-1/2 -translate-y-1/2 -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`lg:hidden overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
          open ? 'max-h-[480px] opacity-100 border-t border-edge/60 visible' : 'max-h-0 opacity-0 invisible'
        }`}
      >
        <div className="px-4 py-3 space-y-1 glass">
          <SearchForm className="pb-2" />
          {[...NAV, { href: '/list', label: 'قائمة [A-Z]' }, { href: '/series', label: 'السلاسل' }, { href: '/about', label: 'من نحن' }, { href: '/random', label: 'فاجئني 🎲' }, { href: '/support', label: 'الدعم الفني' }].map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm hover:bg-card hover:text-accent transition-colors"
            >
              {n.label}
            </Link>
          ))}
          <a
            href="https://rhythm-sub.com/wp-login.php"
            className="block text-center px-3 py-2.5 rounded-xl text-sm font-bold btn-accent mt-2"
          >
            تسجيل الدخول
          </a>
        </div>
      </div>
    </header>
  );
}
