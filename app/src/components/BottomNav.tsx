import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';

const ICONS = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
  ),
  study: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20" />,
  words: (
    <>
      <path d="M4 4.5h9.5A2.5 2.5 0 0 1 16 7v13.5H6.5A2.5 2.5 0 0 1 4 18V4.5Z" />
      <path d="M16 7h4v13.5h-4" />
    </>
  ),
  progress: <path d="M4 20V10m6 10V4m6 16v-7m6 7V8" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M6.9 17.1l-1.4 1.4m0-13 1.4 1.4M17.1 17.1l1.4 1.4" />
    </>
  ),
};

const ITEMS: { to: string; label: string; icon: keyof typeof ICONS }[] = [
  { to: '/', label: t.nav.home, icon: 'home' },
  { to: '/study', label: t.nav.study, icon: 'study' },
  { to: '/words', label: t.nav.words, icon: 'words' },
  { to: '/progress', label: t.nav.progress, icon: 'progress' },
  { to: '/settings', label: t.nav.settings, icon: 'settings' },
];

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)]"
      aria-label="Əsas naviqasiya"
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-11 text-[11px] font-medium ${
              isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
            }`
          }
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[item.icon]}
          </svg>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
