"use client";

import Link from "next/link";
import { useStore } from "@/hooks/useStore";
import { CloudIcon } from "./Icons";

export function syncLabel(sync: { state: string; lastError?: string }, pending: number): { text: string; tone: "ok" | "warn" | "err" | "idle" } {
  if (sync.state === "syncing") return { text: "Sinxron olunur…", tone: "idle" };
  if (sync.state === "error") return { text: "Sinxron xətası", tone: "err" };
  if (pending > 0) return { text: `Gözləyən: ${pending}`, tone: "warn" };
  if (sync.state === "success") return { text: "Sinxron ✓", tone: "ok" };
  return { text: "Sinxron yoxdur", tone: "idle" };
}

/** Başlıqdakı kiçik sinxron göstəricisi — yalnız Sheets istifadə olunursa görünür. */
export function SyncBadge() {
  const { sync, pendingChanges, settings } = useStore();
  const used = Boolean(sync.lastSyncAt) || settings.autoSync || sync.state === "error";
  if (!used) return null;
  const { text, tone } = syncLabel(sync, pendingChanges);
  const cls = { ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", warn: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", err: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", idle: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300" }[tone];
  return (
    <Link href="/settings#sheets" className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${cls}`} aria-label={`Google Sheets: ${text}`}>
      <CloudIcon />
      {text}
    </Link>
  );
}
