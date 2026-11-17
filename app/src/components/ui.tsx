import type { ReactNode } from 'react';
import type { ContentStatus, WordStatus } from '../types';
import { t } from '../lib/i18n';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium min-h-11 px-4 text-[15px] transition-colors active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none';
  const variants: Record<string, string> = {
    primary: 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)]',
    secondary: 'bg-[var(--color-surface-muted)] text-[var(--color-text)] border border-[var(--color-border)]',
    danger: 'bg-[var(--color-danger)] text-white',
    ghost: 'bg-transparent text-[var(--color-text-muted)]',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  VERIFIED: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  LICENSED: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  OWN_CONTENT: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  AI_DRAFT: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  MISSING: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
};

/** Shows the real provenance of a content field (AI_DRAFT/OWN_CONTENT/LICENSED/VERIFIED). */
export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  if (status === 'MISSING') return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${CONTENT_STATUS_COLORS[status]}`}
    >
      {t.contentStatus[status]}
    </span>
  );
}

/** The explicit "not added yet" label a missing content field must show instead of fabricated text. */
export function MissingContentLabel({ text }: { text: string }) {
  return <p className="text-sm italic text-[var(--color-text-muted)]">{text}</p>;
}

const STATUS_COLORS: Record<WordStatus, string> = {
  NEW: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  LEARNING: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  KNOWN: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  DIFFICULT: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
};

export function StatusBadge({ status }: { status: WordStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {t.status[status]}
    </span>
  );
}

export function CefrBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--color-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent)]">
      {level}
    </span>
  );
}

export function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${colorClass ?? 'bg-[var(--color-accent)]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 pt-6 pb-3">
      <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-[var(--color-text-muted)]">
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="animate-fade-in w-full max-w-[420px] rounded-t-2xl bg-[var(--color-surface)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
