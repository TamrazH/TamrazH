"use client";

import { useMemo, useState } from "react";
import type { Transaction } from "@/types";
import { useStore } from "@/hooks/useStore";
import { useFilters } from "@/hooks/useFilters";
import { useToast } from "@/hooks/useToast";
import { activeFilterCount, filterTransactions, groupByDate } from "@/lib/filters";
import { formatDayHeading } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { TYPE_LABEL, TX_TYPES, shortCategoryName } from "@/lib/labels";
import { CloseIcon, FilterIcon, SearchIcon } from "./Icons";
import { ConfirmDialog, EmptyState, Field, ListSkeleton, PageHeader, Sheet } from "./ui";
import { TransactionRow } from "./TransactionRow";
import { TransactionForm } from "./TransactionForm";
import Link from "next/link";

const PAGE = 80;

export function TransactionsView() {
  const store = useStore();
  const { filters, patch, reset, setFilters } = useFilters();
  const toast = useToast();
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const accountsMap = useMemo(() => new Map(store.accounts.map((a) => [a.id, a])), [store.accounts]);
  const categoriesMap = useMemo(() => new Map(store.categories.map((c) => [c.id, c])), [store.categories]);

  const filtered = useMemo(
    () => filterTransactions(store.transactions, filters, store.accounts, store.categories),
    [store.transactions, store.accounts, store.categories, filters],
  );
  const shown = filtered.slice(0, limit);
  const groups = useMemo(() => groupByDate(shown), [shown]);
  const nFilters = activeFilterCount(filters);
  const hasAny = nFilters > 0 || filters.query.trim() !== "";

  const confirmDelete = () => {
    if (!deleting) return;
    store.deleteTransaction(deleting.id);
    setDeleting(null);
    setEditing(null);
    toast.success("Əməliyyat silindi");
  };

  return (
    <div className="page">
      <PageHeader title="Əməliyyatlar" subtitle={store.ready ? `${filtered.length} əməliyyat` : undefined} />

      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <SearchIcon width={20} height={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Axtarış"
            placeholder="Təsvir, hesab, kateqoriya…"
            className="input !pl-10"
            value={filters.query}
            enterKeyHint="search"
            onChange={(e) => { patch({ query: e.target.value }); setLimit(PAGE); }}
          />
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label={`Filtrlər${nFilters ? `, ${nFilters} aktiv` : ""}`}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${nFilters ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"}`}
        >
          <FilterIcon width={22} height={22} />
          {nFilters > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{nFilters}</span>
          )}
        </button>
      </div>

      {nFilters > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Aktiv filtrlər">
          {filters.type && <FilterChip label={TYPE_LABEL[filters.type]} onClear={() => patch({ type: "" })} />}
          {filters.accountId && <FilterChip label={accountsMap.get(filters.accountId)?.name ?? "Hesab"} onClear={() => patch({ accountId: "" })} />}
          {filters.categoryId && <FilterChip label={categoriesMap.get(filters.categoryId) ? shortCategoryName(categoriesMap.get(filters.categoryId)!) : "Kateqoriya"} onClear={() => patch({ categoryId: "" })} />}
          {filters.currency && <FilterChip label={filters.currency} onClear={() => patch({ currency: "" })} />}
          {(filters.dateFrom || filters.dateTo) && (
            <FilterChip label={`${filters.dateFrom || "…"} → ${filters.dateTo || "…"}`} onClear={() => patch({ dateFrom: "", dateTo: "" })} />
          )}
          <button type="button" onClick={reset} className="chip shrink-0 !bg-transparent font-semibold text-brand-500">Hamısını təmizlə</button>
        </div>
      )}

      {!store.ready ? (
        <ListSkeleton />
      ) : store.transactions.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Hələ əməliyyat yoxdur"
          text="İlk gəlir və ya xərcinizi əlavə edin — balans avtomatik hesablanacaq."
          action={<Link href="/add" className="btn-primary">Əməliyyat əlavə et</Link>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Heç nə tapılmadı"
          text="Axtarış və ya filtr şərtlərinə uyğun əməliyyat yoxdur."
          action={hasAny ? <button type="button" className="btn-secondary" onClick={reset}>Filtrləri təmizlə</button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.date} aria-label={formatDayHeading(g.date)}>
              <h2 className="mb-1 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {formatDayHeading(g.date)}
              </h2>
              <div className="card divide-y divide-slate-100 !p-2 dark:divide-slate-800">
                {g.items.map((t) => (
                  <TransactionRow key={t.id} tx={t} accounts={accountsMap} categories={categoriesMap} onClick={() => setEditing(t)} />
                ))}
              </div>
            </section>
          ))}
          {filtered.length > limit && (
            <button type="button" className="btn-secondary w-full" onClick={() => setLimit((l) => l + PAGE)}>
              Daha çox göstər ({filtered.length - limit})
            </button>
          )}
        </div>
      )}

      {/* Redaktə */}
      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title="Əməliyyatı redaktə et">
        {editing && (
          <div className="space-y-4">
            <TransactionForm key={editing.id} initial={editing} onSaved={() => setEditing(null)} />
            <button type="button" className="btn-danger w-full" onClick={() => setDeleting(editing)}>
              Əməliyyatı sil
            </button>
            <p className="text-center text-[12px] text-slate-500 dark:text-slate-400">
              Yaradılıb: {editing.createdAt.slice(0, 16).replace("T", " ")}
            </p>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Əməliyyat silinsin?"
        message={
          deleting && (
            <>
              <strong>{deleting.description || "Əməliyyat"}</strong> — {formatMoney(deleting.amount, deleting.currency)}
              <br />Bu əməliyyat silinəcək və hesab balansları yenidən hesablanacaq.
            </>
          )
        }
        confirmLabel="Bəli, sil"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      {/* Filtrlər */}
      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtrlər"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={() => { setFilters({ ...filters, dateFrom: "", dateTo: "", accountId: "", categoryId: "", currency: "", type: "" }); }}>Sıfırla</button>
            <button type="button" className="btn-primary" onClick={() => { setFilterOpen(false); setLimit(PAGE); }}>Göstər ({filtered.length})</button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Növ" htmlFor="f-type">
            <select id="f-type" className="input" value={filters.type} onChange={(e) => patch({ type: e.target.value as typeof filters.type })}>
              <option value="">Hamısı</option>
              {TX_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Hesab" htmlFor="f-acc">
            <select id="f-acc" className="input" value={filters.accountId} onChange={(e) => patch({ accountId: e.target.value })}>
              <option value="">Bütün hesablar</option>
              {store.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.isActive ? "" : " (arxiv)"}</option>)}
            </select>
          </Field>
          <Field label="Kateqoriya" htmlFor="f-cat">
            <select id="f-cat" className="input" value={filters.categoryId} onChange={(e) => patch({ categoryId: e.target.value })}>
              <option value="">Bütün kateqoriyalar</option>
              {store.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Valyuta" htmlFor="f-cur">
            <select id="f-cur" className="input" value={filters.currency} onChange={(e) => patch({ currency: e.target.value as typeof filters.currency })}>
              <option value="">AZN və USD</option>
              <option value="AZN">AZN</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tarixdən" htmlFor="f-from">
              <input id="f-from" type="date" className="input" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => patch({ dateFrom: e.target.value })} />
            </Field>
            <Field label="Tarixədək" htmlFor="f-to">
              <input id="f-to" type="date" className="input" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => patch({ dateTo: e.target.value })} />
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" onClick={onClear} className="chip shrink-0 gap-1.5 !bg-brand-50 !text-brand-700 dark:!bg-brand-700/30 dark:!text-brand-100" aria-label={`${label} filtrini sil`}>
      {label}
      <CloseIcon width={14} height={14} />
    </button>
  );
}
