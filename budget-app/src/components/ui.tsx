"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import Link from "next/link";
import { CloseIcon, ChevronLeft } from "./Icons";

/* ---------- Səhifə başlığı ---------- */
export function PageHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: string;
}) {
  return (
    <header
      className="sticky top-0 z-30 -mx-4 mb-3 bg-[#f4f6fa]/90 px-4 pb-2 backdrop-blur-xl dark:bg-[#0b1020]/90"
      style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
    >
      <div className="flex min-h-[44px] items-center gap-2">
        {back && (
          <Link href={back} aria-label="Geri" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-brand-500">
            <ChevronLeft />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

/* ---------- Boş vəziyyət ---------- */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-5xl" aria-hidden>{icon}</div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {text && <p className="mt-1 max-w-[280px] text-[14px] text-slate-500 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Yüklənir" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}

/* ---------- Seqmentli seçim ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  columns,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; color?: string }[];
  label: string;
  columns?: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] rounded-lg px-1 text-[13px] font-semibold transition ${
              active
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Switch ---------- */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[16px] font-medium">{label}</label>
        {description && <p className="text-[13px] text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
      >
        <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-[2px]"}`} />
      </button>
    </div>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 animate-fade bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-[#f4f6fa] shadow-2xl outline-none dark:bg-slate-950"
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 id={titleId} className="text-[19px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bağla"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2"
          style={footer ? undefined : { paddingBottom: "calc(var(--safe-bottom) + 20px)" }}
        >
          {children}
        </div>
        {footer && (
          <div className="border-t border-slate-200 px-4 pt-3 dark:border-slate-800" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Təsdiq dialoqu ---------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Ləğv et",
  danger,
  onConfirm,
  onCancel,
  extra,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  extra?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-6">
      <div className="absolute inset-0 animate-fade bg-slate-900/60" onClick={onCancel} aria-hidden />
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-sheet relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl outline-none dark:bg-slate-900"
      >
        <h2 id={titleId} className="text-[18px] font-bold">{title}</h2>
        <div className="mt-2 text-[15px] text-slate-600 dark:text-slate-300">{message}</div>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={onConfirm} className={danger ? "btn bg-rose-600 text-white active:bg-rose-700" : "btn-primary"}>
            {confirmLabel}
          </button>
          {extra}
          <button type="button" onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
