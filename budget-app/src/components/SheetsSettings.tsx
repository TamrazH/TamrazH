"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { useOnline } from "@/hooks/useOnline";
import { fetchSyncStatus, SyncError, type SyncStatusResponse } from "@/services/sync-client";
import { Toggle } from "./ui";
import { syncLabel } from "./SyncBadge";

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SheetsSettings() {
  const store = useStore();
  const toast = useToast();
  const online = useOnline();
  const { sync, pendingChanges, settings } = store;
  const [status, setStatus] = useState<SyncStatusResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!online) return;
    fetchSyncStatus("").then(setStatus).catch(() => setStatus(null));
  }, [online]);

  const check = async () => {
    setChecking(true);
    setError("");
    try {
      const s = await fetchSyncStatus(settings.syncToken, true);
      setStatus(s);
      if (s.error) setError(s.error);
      else if (s.connected) toast.success(`Bağlantı uğurludur: “${s.title}”`);
    } catch (e) {
      setError(e instanceof SyncError ? e.message : "Bağlantı yoxlanıla bilmədi.");
    } finally {
      setChecking(false);
    }
  };

  const runSync = async () => {
    setError("");
    const ok = await store.syncNow();
    if (ok) toast.success("Sinxron tamamlandı");
  };

  const label = syncLabel(sync, pendingChanges);
  const tone = { ok: "text-emerald-600 dark:text-emerald-400", warn: "text-amber-600 dark:text-amber-400", err: "text-rose-600 dark:text-rose-400", idle: "text-slate-500 dark:text-slate-400" }[label.tone];

  return (
    <section id="sheets" className="card space-y-3 scroll-mt-20" aria-labelledby="sheets-title">
      <h2 id="sheets-title" className="text-[17px] font-bold">Google Sheets</h2>

      {status && !status.configured && (
        <div role="alert" className="rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Server tərəfdə konfiqurasiya tamamlanmayıb.</p>
          <p className="mt-1">Çatışan environment dəyişənləri:</p>
          <ul className="mt-1 list-disc pl-5">{status.missing.map((m) => <li key={m} className="break-words font-mono text-[12px]">{m}</li>)}</ul>
          <p className="mt-1">README-dəki “Google Sheets quraşdırması” bölməsinə baxın.</p>
        </div>
      )}
      {status?.configured && !status.error && (
        <p className="text-[14px] text-emerald-700 dark:text-emerald-400">✓ Server konfiqurasiyası tamdır</p>
      )}

      {status?.tokenRequired && (
        <div>
          <label htmlFor="sync-token" className="label">Sinxron parolu (APP_SYNC_TOKEN)</label>
          <input id="sync-token" type="password" className="input" autoComplete="off" autoCapitalize="none" value={settings.syncToken} onChange={(e) => store.updateSettings({ syncToken: e.target.value })} placeholder="Server tərəfdə təyin etdiyiniz parol" />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[14px]">
        <dt className="text-slate-500 dark:text-slate-400">Status</dt>
        <dd className={`font-semibold ${tone}`}>
          {sync.state === "success" && pendingChanges === 0 ? "Uğurlu" : label.text}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Son sinxron</dt>
        <dd className="num font-semibold">{formatWhen(sync.lastSyncAt)}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Gözləyən dəyişikliklər</dt>
        <dd className="num font-semibold">{pendingChanges}</dd>
      </dl>

      {(sync.state === "error" && sync.lastError) || error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-[14px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          Xəta: {error || sync.lastError}
        </p>
      ) : null}

      <Toggle checked={settings.autoSync} onChange={(v) => store.updateSettings({ autoSync: v })} label="Avtomatik sinxron" description="Dəyişiklikdən bir neçə saniyə sonra (onlayn olduqda)" />

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={check} disabled={checking || !online || status?.configured === false}>{checking ? "Yoxlanır…" : "Bağlantını yoxla"}</button>
        <button type="button" className="btn-primary" onClick={runSync} disabled={sync.state === "syncing" || !online || status?.configured === false}>{sync.state === "syncing" ? "Sinxron…" : "İndi sinxron et"}</button>
      </div>
      {!online && <p className="text-[13px] text-amber-600 dark:text-amber-400">Oflayn — sinxron üçün internet lazımdır. Dəyişiklikləriniz cihazda saxlanılır.</p>}
      <p className="text-[12px] text-slate-500 dark:text-slate-400">Konflikt halında hər qeydin ən son dəyişdirilmiş (updatedAt) versiyası qalib gəlir. Sheets-ə Transactions, Accounts və Categories vərəqləri yazılır.</p>
    </section>
  );
}
