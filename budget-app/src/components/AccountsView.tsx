"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Account, AccountCurrency, AccountType } from "@/types";
import { useStore } from "@/hooks/useStore";
import { useFilters } from "@/hooks/useFilters";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/useToast";
import { formatMoney, parseAmount, round2 } from "@/lib/money";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_ORDER, CURRENCY_LABEL, isDebtAccount } from "@/lib/labels";
import { EMPTY_FILTERS } from "@/lib/filters";
import { ChevronRight, PlusIcon } from "./Icons";
import { ConfirmDialog, EmptyState, Field, ListSkeleton, PageHeader, Sheet, Skeleton, Toggle } from "./ui";

const TYPE_EMOJI: Record<AccountType, string> = {
  bank: "🏛️", card: "💳", cash: "💵", crypto: "🪙", deposit: "🏦", investment: "📈", debtor: "🤝", creditor: "📝", other: "📦",
};

function BalanceText({ account, balance }: { account: Account; balance: { AZN: number; USD: number } }) {
  const parts: { cur: "AZN" | "USD"; v: number }[] = [];
  if (account.currency === "AZN") parts.push({ cur: "AZN", v: balance.AZN });
  else if (account.currency === "USD") parts.push({ cur: "USD", v: balance.USD });
  else {
    if (balance.AZN !== 0 || balance.USD === 0) parts.push({ cur: "AZN", v: balance.AZN });
    if (balance.USD !== 0) parts.push({ cur: "USD", v: balance.USD });
  }
  const debt = isDebtAccount(account);
  return (
    <span className="num flex shrink-0 flex-col items-end text-right">
      {parts.map((p) => (
        <span
          key={p.cur}
          className={`text-[16px] font-bold ${
            debt ? (p.v > 0 ? "text-emerald-600 dark:text-emerald-400" : p.v < 0 ? "text-rose-600 dark:text-rose-400" : "") : p.v < 0 ? "text-rose-600 dark:text-rose-400" : ""
          }`}
        >
          {formatMoney(p.v, p.cur)}
        </span>
      ))}
      {debt && parts.some((p) => p.v !== 0) && (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {parts.every((p) => p.v >= 0) ? "mənə borclu" : parts.every((p) => p.v <= 0) ? "mən borcluyam" : "qarışıq"}
        </span>
      )}
    </span>
  );
}

interface Draft {
  name: string;
  type: AccountType;
  currency: AccountCurrency;
  opening: string;
  openingUsd: string;
  isActive: boolean;
}

const emptyDraft: Draft = { name: "", type: "cash", currency: "AZN", opening: "", openingUsd: "", isActive: true };

function toInput(n: number | undefined) {
  return n === undefined || n === 0 ? "" : String(n).replace(".", ",");
}

export function AccountsView() {
  const store = useStore();
  const { setFilters } = useFilters();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<"name" | "opening" | "openingUsd" | "currency", string>>>({});
  const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
  const [inUse, setInUse] = useState<{ account: Account; count: number } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = store.accounts.filter((a) => a.isActive);
  const archived = store.accounts.filter((a) => !a.isActive);
  const grouped = useMemo(
    () => ACCOUNT_TYPE_ORDER.map((t) => ({ type: t, items: active.filter((a) => a.type === t) })).filter((g) => g.items.length),
    [active],
  );

  const openEdit = (a: Account | "new") => {
    setErrors({});
    if (a === "new") setDraft(emptyDraft);
    else setDraft({ name: a.name, type: a.type, currency: a.currency, opening: toInput(a.openingBalance), openingUsd: toInput(a.openingBalanceUsd), isActive: a.isActive });
    setEditing(a);
  };

  const parseOpening = (s: string): number => (s.trim() === "" ? 0 : s.trim().startsWith("-") ? -parseAmount(s.trim().slice(1)) : parseAmount(s));

  const save = () => {
    const e: typeof errors = {};
    const name = draft.name.trim();
    if (!name) e.name = "Hesab adını daxil edin";
    else if (store.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase() && (editing === "new" || a.id !== (editing as Account).id))) e.name = "Bu adda hesab artıq mövcuddur";
    const opening = parseOpening(draft.opening);
    if (Number.isNaN(opening)) e.opening = "Düzgün rəqəm daxil edin";
    const openingUsd = parseOpening(draft.openingUsd);
    if (draft.currency === "multi" && Number.isNaN(openingUsd)) e.openingUsd = "Düzgün rəqəm daxil edin";

    // Valyuta dəyişikliyi mövcud əməliyyatlarla uyğunsuz ola bilər
    if (editing && editing !== "new" && draft.currency !== "multi") {
      const conflicting = store.transactions.filter((t) => {
        if (t.accountId === editing.id) return t.currency !== draft.currency;
        if (t.toAccountId === editing.id) return (t.toAmount !== undefined ? false : t.currency !== draft.currency);
        return false;
      }).length;
      if (conflicting > 0) e.currency = `Bu hesabda başqa valyutalı ${conflicting} əməliyyat var. Valyutanı "AZN + USD" saxlayın.`;
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    store.saveAccount(editing === "new" ? null : (editing as Account).id, {
      name,
      type: draft.type,
      currency: draft.currency,
      openingBalance: round2(opening),
      ...(draft.currency === "multi" ? { openingBalanceUsd: round2(openingUsd) } : {}),
      isActive: draft.isActive,
    });
    toast.success(editing === "new" ? "Hesab əlavə edildi" : "Hesab yeniləndi");
    setEditing(null);
  };

  const requestDelete = (a: Account) => {
    const count = store.accountUsage(a.id);
    if (count > 0) setInUse({ account: a, count });
    else setConfirmDelete(a);
  };

  const doDelete = () => {
    if (!confirmDelete) return;
    const r = store.deleteAccount(confirmDelete.id);
    setConfirmDelete(null);
    setEditing(null);
    if (r.ok) toast.success("Hesab silindi");
  };

  const doArchive = (a: Account, archive: boolean) => {
    store.archiveAccount(a.id, archive);
    setInUse(null);
    setEditing(null);
    toast.success(archive ? "Hesab arxivləşdirildi" : "Hesab arxivdən çıxarıldı");
  };

  const viewTransactions = (a: Account) => {
    setFilters({ ...EMPTY_FILTERS, accountId: a.id });
    setEditing(null);
    router.push("/transactions");
  };

  const { totals, settings } = store;

  return (
    <div className="page">
      <PageHeader title="Hesablar" right={<button type="button" onClick={() => openEdit("new")} className="btn-primary !min-h-[44px] !px-3.5 !text-[15px]"><PlusIcon width={18} height={18} />Hesab</button>} />

      {!store.ready ? (
        <div className="space-y-4" role="status" aria-label="Yüklənir"><Skeleton className="h-36" /><ListSkeleton /></div>
      ) : (
        <div className="space-y-5">
          <section className="card" aria-label="Ümumi balans">
            <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Ümumi balans (borclar xaric)</p>
            <p className="num text-[28px] font-bold leading-tight">{formatMoney(totals.equivalentAzn, "AZN")}</p>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-[14px]">
              <div><dt className="text-slate-500 dark:text-slate-400">AZN</dt><dd className="num font-bold">{formatMoney(totals.AZN, "AZN")}</dd></div>
              <div><dt className="text-slate-500 dark:text-slate-400">USD</dt><dd className="num font-bold">{formatMoney(totals.USD, "USD")}</dd></div>
            </dl>
            <p className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">Məzənnə: 1 $ = {formatMoney(settings.usdRate, "AZN")} · <Link href="/settings" className="font-semibold text-brand-500">dəyiş</Link></p>
            {(totals.receivableAzn > 0 || totals.payableAzn > 0) && (
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div><p className="text-[12px] text-slate-500 dark:text-slate-400">Mənə borcludurlar</p><p className="num font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(totals.receivableAzn, "AZN")}</p></div>
                <div><p className="text-[12px] text-slate-500 dark:text-slate-400">Mən borcluyam</p><p className="num font-bold text-rose-600 dark:text-rose-400">{formatMoney(totals.payableAzn, "AZN")}</p></div>
              </div>
            )}
          </section>

          {grouped.length === 0 ? (
            <EmptyState icon="👛" title="Hesab yoxdur" text="Nağd, kart və ya bank hesabı əlavə edin." action={<button type="button" className="btn-primary" onClick={() => openEdit("new")}>Hesab əlavə et</button>} />
          ) : (
            grouped.map((g) => (
              <section key={g.type} aria-label={ACCOUNT_TYPE_LABEL[g.type]}>
                <h2 className="mb-1 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{ACCOUNT_TYPE_LABEL[g.type]}</h2>
                <ul className="card divide-y divide-slate-100 !p-2 dark:divide-slate-800">
                  {g.items.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => openEdit(a)} className="flex min-h-[60px] w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-slate-100 dark:active:bg-slate-800/60">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-800" aria-hidden>{TYPE_EMOJI[a.type]}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold">{a.name}</span>
                          <span className="block text-[12px] text-slate-500 dark:text-slate-400">{CURRENCY_LABEL[a.currency]}</span>
                        </span>
                        <BalanceText account={a} balance={store.balances.get(a.id) ?? { AZN: 0, USD: 0 }} />
                        <ChevronRight className="shrink-0 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}

          {archived.length > 0 && (
            <section>
              <button type="button" className="flex min-h-[44px] items-center gap-1 px-1 text-[14px] font-semibold text-slate-500 dark:text-slate-400" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
                Arxiv ({archived.length}) {showArchived ? "▴" : "▾"}
              </button>
              {showArchived && (
                <ul className="card divide-y divide-slate-100 !p-2 opacity-80 dark:divide-slate-800">
                  {archived.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => openEdit(a)} className="flex min-h-[56px] w-full items-center gap-3 px-1 text-left">
                        <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                        <BalanceText account={a} balance={store.balances.get(a.id) ?? { AZN: 0, USD: 0 }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Yeni hesab" : "Hesabı redaktə et"}
        footer={<button type="button" className="btn-primary w-full" onClick={save}>Yadda saxla</button>}
      >
        <div className="space-y-4">
          <Field label="Ad" htmlFor="acc-name" error={errors.name}>
            <input id="acc-name" className="input" value={draft.name} maxLength={80} autoCapitalize="words" aria-invalid={Boolean(errors.name)} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Növ" htmlFor="acc-type">
            <select id="acc-type" className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as AccountType })}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Valyuta" htmlFor="acc-cur" error={errors.currency}>
            <select id="acc-cur" className="input" value={draft.currency} aria-invalid={Boolean(errors.currency)} onChange={(e) => setDraft({ ...draft, currency: e.target.value as AccountCurrency })}>
              {(Object.keys(CURRENCY_LABEL) as AccountCurrency[]).map((c) => <option key={c} value={c}>{CURRENCY_LABEL[c]}</option>)}
            </select>
          </Field>
          <div className={draft.currency === "multi" ? "grid grid-cols-2 gap-3" : ""}>
            <Field label={draft.currency === "USD" ? "Başlanğıc qalıq ($)" : draft.currency === "multi" ? "Başlanğıc AZN" : "Başlanğıc qalıq (₼)"} htmlFor="acc-open" error={errors.opening} hint={isDebtAccount({ type: draft.type }) ? "Borc hesabında: müsbət = o sizə borcludur, mənfi = siz ona borclusunuz." : undefined}>
              <input id="acc-open" className="input num" inputMode="decimal" placeholder="0,00" value={draft.opening} aria-invalid={Boolean(errors.opening)} onChange={(e) => setDraft({ ...draft, opening: e.target.value.replace(/[^0-9.,\-\s]/g, "") })} />
            </Field>
            {draft.currency === "multi" && (
              <Field label="Başlanğıc USD" htmlFor="acc-open-usd" error={errors.openingUsd}>
                <input id="acc-open-usd" className="input num" inputMode="decimal" placeholder="0,00" value={draft.openingUsd} aria-invalid={Boolean(errors.openingUsd)} onChange={(e) => setDraft({ ...draft, openingUsd: e.target.value.replace(/[^0-9.,\-\s]/g, "") })} />
              </Field>
            )}
          </div>
          {editing !== "new" && editing && (
            <>
              <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Aktiv" description="Arxivləşdirilmiş hesab yeni əməliyyatlarda görünmür" />
              <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button type="button" className="btn-secondary w-full" onClick={() => viewTransactions(editing)}>Əməliyyatlara bax</button>
                <button type="button" className="btn-danger w-full" onClick={() => requestDelete(editing)}>Hesabı sil</button>
              </div>
            </>
          )}
        </div>
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        danger
        title="Hesab silinsin?"
        message={<>“{confirmDelete?.name}” hesabı silinəcək. Bu hesabda əməliyyat yoxdur.</>}
        confirmLabel="Bəli, sil"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={Boolean(inUse)}
        title="Hesabı silmək olmaz"
        message={<>“{inUse?.account.name}” hesabında <strong>{inUse?.count}</strong> əməliyyat var. Silsəniz balans və tarixçə pozular. Əvəzinə hesabı arxivləşdirə bilərsiniz — əməliyyatlar saxlanılır, hesab isə yeni əməliyyatlarda görünmür.</>}
        confirmLabel="Arxivləşdir"
        onConfirm={() => inUse && doArchive(inUse.account, true)}
        onCancel={() => setInUse(null)}
      />
    </div>
  );
}
