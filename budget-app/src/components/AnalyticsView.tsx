"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { accountMovements, expenseByCategory, lastMonthsBars, summarizeMonth } from "@/lib/analytics";
import { formatMonthLabel, monthKey, shiftMonth, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ChevronLeft, ChevronRight } from "./Icons";
import { DonutChart, MonthBars } from "./Charts";
import { EmptyState, PageHeader, Skeleton } from "./ui";

export function AnalyticsView() {
  const store = useStore();
  const current = monthKey(todayISO());
  const [month, setMonth] = useState(current);
  const rate = store.settings.usdRate;

  const summary = useMemo(() => summarizeMonth(store.transactions, month, rate), [store.transactions, month, rate]);
  const bars = useMemo(() => lastMonthsBars(store.transactions, month, 6, rate), [store.transactions, month, rate]);
  const slices = useMemo(() => expenseByCategory(store.transactions, store.categories, month, rate), [store.transactions, store.categories, month, rate]);
  const movements = useMemo(() => accountMovements(store.transactions, store.accounts, month, rate), [store.transactions, store.accounts, month, rate]);
  const totalExpense = summary.expense.eqAzn;
  const maxMove = Math.max(1, ...movements.map((m) => Math.max(m.inflow, m.outflow)));
  const hasData = store.transactions.some((t) => t.date.startsWith(month));

  const tiles = [
    { key: "income", label: "Gəlir", color: "text-emerald-600 dark:text-emerald-400", v: summary.income },
    { key: "expense", label: "Xərc", color: "text-rose-600 dark:text-rose-400", v: summary.expense },
    { key: "transfer", label: "Transfer", color: "text-brand-600 dark:text-brand-100", v: summary.transfer },
    { key: "investment", label: "İnvestisiya", color: "text-purple-600 dark:text-purple-400", v: summary.investment },
  ] as const;

  return (
    <div className="page">
      <PageHeader title="Analitika" />
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-1 py-1 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
        <button type="button" aria-label="Əvvəlki ay" onClick={() => setMonth(shiftMonth(month, -1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-500 active:bg-slate-100 dark:active:bg-slate-800"><ChevronLeft /></button>
        <button type="button" onClick={() => setMonth(current)} className="min-h-[44px] px-3 text-[17px] font-bold" aria-label={`${formatMonthLabel(month)}, cari aya qayıt`}>{formatMonthLabel(month)}</button>
        <button type="button" aria-label="Növbəti ay" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))} className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-500 active:bg-slate-100 disabled:opacity-30 dark:active:bg-slate-800"><ChevronRight width={24} height={24} /></button>
      </div>

      {!store.ready ? (
        <div className="space-y-4" role="status" aria-label="Yüklənir"><Skeleton className="h-40" /><Skeleton className="h-52" /></div>
      ) : !hasData ? (
        <EmptyState icon="📊" title="Bu ay üçün məlumat yoxdur" text="Başqa ay seçin və ya yeni əməliyyat əlavə edin." />
      ) : (
        <div className="space-y-4">
          <section aria-label="Aylıq həcmlər" className="grid grid-cols-2 gap-2.5">
            {tiles.map((t) => (
              <div key={t.key} className="card !p-3.5">
                <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{t.label}</p>
                <p className={`num mt-0.5 text-[19px] font-bold ${t.color}`}>{formatMoney(t.v.eqAzn, "AZN")}</p>
                {(t.v.USD > 0 && t.v.AZN > 0) && (
                  <p className="num mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{formatMoney(t.v.AZN, "AZN")} + {formatMoney(t.v.USD, "USD")}</p>
                )}
                {(t.v.USD > 0 && t.v.AZN === 0) && <p className="num mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{formatMoney(t.v.USD, "USD")}</p>}
              </div>
            ))}
          </section>
          <p className="px-1 text-[12px] text-slate-500 dark:text-slate-400">USD məbləğləri 1 $ = {formatMoney(rate, "AZN")} məzənnəsi ilə AZN-ə çevrilib. Məzənnəni Əsas səhifədən dəyişə bilərsiniz.</p>

          <section className="card" aria-label="Son 6 ay">
            <h2 className="mb-1 text-[16px] font-bold">Son 6 ay</h2>
            <div className="mb-1 flex gap-4 text-[12px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#16a34a]" />Gəlir</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#e11d48]" />Xərc</span>
            </div>
            <MonthBars bars={bars} selected={month} />
          </section>

          <section className="card" aria-label="Xərclər kateqoriyalar üzrə">
            <h2 className="mb-2 text-[16px] font-bold">Xərclər kateqoriyalar üzrə</h2>
            {slices.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-slate-500 dark:text-slate-400">Bu ay xərc yoxdur.</p>
            ) : (
              <>
                <DonutChart slices={slices} total={totalExpense} />
                <ul className="mt-3 space-y-0.5">
                  {slices.map((s) => (
                    <li key={s.categoryId} className="flex min-h-[44px] items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[15px]">{s.name}</span>
                      <span className="num text-[13px] text-slate-500 dark:text-slate-400">{s.percent.toFixed(1).replace(".", ",")}%</span>
                      <span className="num w-[92px] text-right text-[15px] font-semibold">{formatMoney(s.value, "AZN")}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card" aria-label="Hesab üzrə hərəkətlər">
            <h2 className="mb-2 text-[16px] font-bold">Hesab üzrə hərəkətlər</h2>
            <ul className="space-y-3">
              {movements.map((m) => (
                <li key={m.accountId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[15px] font-semibold">{m.name}</span>
                    <span className={`num text-[14px] font-bold ${m.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{formatMoney(m.net, "AZN", { showPlus: true })}</span>
                  </div>
                  <div className="mt-1 space-y-1" aria-hidden>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(m.inflow / maxMove) * 100}%` }} /></div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-rose-500" style={{ width: `${(m.outflow / maxMove) * 100}%` }} /></div>
                  </div>
                  <div className="num mt-1 flex justify-between text-[12px] text-slate-500 dark:text-slate-400">
                    <span>Daxil: {formatMoney(m.inflow, "AZN")}</span>
                    <span>Çıxış: {formatMoney(m.outflow, "AZN")}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
