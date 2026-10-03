"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { formatMoney, parseAmount, round2 } from "@/lib/money";
import { monthKey, formatMonthLabel, todayISO } from "@/lib/dates";
import { summarizeMonth } from "@/lib/analytics";
import { ChevronRight } from "./Icons";
import { EmptyState, Field, ListSkeleton, PageHeader, Sheet, Skeleton } from "./ui";
import { TransactionRow } from "./TransactionRow";
import { SyncBadge } from "./SyncBadge";
import { TransactionForm } from "./TransactionForm";
import type { Transaction } from "@/types";

export function HomeView() {
  const store = useStore();
  const toast = useToast();
  const [rateOpen, setRateOpen] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [rateError, setRateError] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const accountsMap = useMemo(() => new Map(store.accounts.map((a) => [a.id, a])), [store.accounts]);
  const categoriesMap = useMemo(() => new Map(store.categories.map((c) => [c.id, c])), [store.categories]);
  const month = monthKey(todayISO());
  const summary = useMemo(
    () => summarizeMonth(store.transactions, month, store.settings.usdRate),
    [store.transactions, month, store.settings.usdRate],
  );
  const { totals, settings } = store;
  const hasDebt = totals.receivableAzn > 0 || totals.payableAzn > 0;
  const net = round2(summary.income.eqAzn - summary.expense.eqAzn);

  const saveRate = () => {
    const v = parseAmount(rateInput);
    if (!Number.isFinite(v) || v <= 0 || v > 1000) {
      setRateError("Məzənnə sıfırdan böyük düzgün rəqəm olmalıdır (məs. 1,70)");
      return;
    }
    store.updateSettings({ usdRate: Math.round(v * 10000) / 10000 });
    setRateOpen(false);
    toast.success("Məzənnə yeniləndi");
  };

  return (
    <div className="page">
      <PageHeader title="Büdcə" subtitle={formatMonthLabel(month)} right={<SyncBadge />} />

      {!store.ready ? (
        <div className="space-y-4" role="status" aria-label="Yüklənir">
          <Skeleton className="h-44" />
          <div className="grid grid-cols-3 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <div className="space-y-4">
          <section aria-label="Ümumi balans" className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-lg shadow-brand-500/25">
            <p className="text-[13px] font-medium text-white/80">Ümumi balans (AZN ekvivalenti)</p>
            <p className="num mt-1 text-[34px] font-bold leading-tight tracking-tight">{formatMoney(totals.equivalentAzn, "AZN")}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-[12px] text-white/75">AZN hesablar</p>
                <p className="num text-[18px] font-bold">{formatMoney(totals.AZN, "AZN")}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-[12px] text-white/75">USD hesablar</p>
                <p className="num text-[18px] font-bold">{formatMoney(totals.USD, "USD")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setRateInput(String(settings.usdRate).replace(".", ",")); setRateError(""); setRateOpen(true); }}
              className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-xl text-[13px] text-white/85"
            >
              <span>Məzənnə: 1 $ = {formatMoney(settings.usdRate, "AZN")}</span>
              <span className="flex items-center gap-1 font-semibold">Dəyiş <ChevronRight /></span>
            </button>
          </section>

          {hasDebt && (
            <Link href="/accounts" className="card grid grid-cols-2 gap-3" aria-label="Borc balansı, hesablara keç">
              <div>
                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">Mənə borcludurlar</p>
                <p className="num text-[18px] font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totals.receivableAzn, "AZN")}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">Mən borcluyam</p>
                <p className="num text-[18px] font-bold text-rose-600 dark:text-rose-400">{formatMoney(totals.payableAzn, "AZN")}</p>
              </div>
            </Link>
          )}

          <section aria-label="Bu ayın göstəriciləri">
            <div className="grid grid-cols-3 gap-2.5">
              <Stat label="Gəlir" value={formatMoney(summary.income.eqAzn, "AZN")} tone="income" />
              <Stat label="Xərc" value={formatMoney(summary.expense.eqAzn, "AZN")} tone="expense" />
              <Stat label="Fərq" value={formatMoney(net, "AZN", { showPlus: true })} tone={net >= 0 ? "income" : "expense"} />
            </div>
          </section>

          <section aria-label="Sürətli əlavə" className="grid grid-cols-3 gap-2.5">
            <Link href="/add?type=expense" className="btn-secondary !min-h-[52px] flex-col !gap-0 !text-[14px]"><span aria-hidden>⬆️</span>Xərc</Link>
            <Link href="/add?type=income" className="btn-secondary !min-h-[52px] flex-col !gap-0 !text-[14px]"><span aria-hidden>⬇️</span>Gəlir</Link>
            <Link href="/add?type=transfer" className="btn-secondary !min-h-[52px] flex-col !gap-0 !text-[14px]"><span aria-hidden>🔁</span>Transfer</Link>
          </section>

          <section aria-label="Son əməliyyatlar">
            <div className="mb-1 flex items-center justify-between px-1">
              <h2 className="text-[17px] font-bold">Son əməliyyatlar</h2>
              <Link href="/transactions" className="flex min-h-[44px] items-center text-[14px] font-semibold text-brand-500">Hamısı</Link>
            </div>
            {store.transactions.length === 0 ? (
              <div className="card">
                <EmptyState icon="💸" title="Hələ əməliyyat yoxdur" text="Alt ortadakı “+” düyməsi ilə ilk əməliyyatınızı qeyd edin." action={<Link href="/add" className="btn-primary">Əməliyyat əlavə et</Link>} />
              </div>
            ) : (
              <div className="card divide-y divide-slate-100 !p-2 dark:divide-slate-800">
                {store.transactions.slice(0, 6).map((t) => (
                  <TransactionRow key={t.id} tx={t} accounts={accountsMap} categories={categoriesMap} onClick={() => setEditing(t)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Sheet
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title="USD məzənnəsi"
        footer={<button type="button" className="btn-primary w-full" onClick={saveRate}>Yadda saxla</button>}
      >
        <Field label="1 USD neçə AZN?" htmlFor="rate" error={rateError} hint="Ümumi balans və analitikada USD məbləğləri bu məzənnə ilə AZN-ə çevrilir.">
          <input id="rate" className="input num" inputMode="decimal" value={rateInput} aria-invalid={Boolean(rateError)} onChange={(e) => setRateInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRate()} />
        </Field>
      </Sheet>

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title="Əməliyyatı redaktə et">
        {editing && <TransactionForm key={editing.id} initial={editing} onSaved={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "income" | "expense" }) {
  return (
    <div className="card !p-3">
      <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`num mt-0.5 truncate text-[15px] font-bold ${tone === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{value}</p>
    </div>
  );
}
