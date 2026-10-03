import type { Account, Category, Currency, Transaction, TransactionType } from "@/types";

export interface TransactionFilters {
  query: string;
  dateFrom: string;
  dateTo: string;
  accountId: string;
  categoryId: string;
  currency: "" | Currency;
  type: "" | TransactionType;
}

export const EMPTY_FILTERS: TransactionFilters = {
  query: "",
  dateFrom: "",
  dateTo: "",
  accountId: "",
  categoryId: "",
  currency: "",
  type: "",
};

/** Axtarışdan başqa neçə filtr aktivdir (badge üçün) */
export function activeFilterCount(f: TransactionFilters): number {
  return [f.dateFrom, f.dateTo, f.accountId, f.categoryId, f.currency, f.type].filter(Boolean).length;
}

function norm(s: string): string {
  return s.toLocaleLowerCase("az").normalize("NFC");
}

export function filterTransactions(
  txs: Transaction[],
  f: TransactionFilters,
  accounts: Account[],
  categories: Category[],
): Transaction[] {
  const accName = new Map(accounts.map((a) => [a.id, norm(a.name)]));
  const catName = new Map(categories.map((c) => [c.id, norm(c.name)]));
  const q = norm(f.query.trim());
  return txs.filter((t) => {
    if (t.deletedAt) return false;
    if (f.dateFrom && t.date < f.dateFrom) return false;
    if (f.dateTo && t.date > f.dateTo) return false;
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
    if (f.categoryId && t.categoryId !== f.categoryId) return false;
    if (f.currency && t.currency !== f.currency) return false;
    if (f.type && t.type !== f.type) return false;
    if (q) {
      const hay = [
        norm(t.description),
        norm(t.notes ?? ""),
        accName.get(t.accountId) ?? "",
        t.toAccountId ? (accName.get(t.toAccountId) ?? "") : "",
        catName.get(t.categoryId) ?? "",
      ].join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Tarixə görə (yeni -> köhnə), eyni gündə yaradılma vaxtına görə sıralayır */
export function sortTransactions(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  );
}

export function groupByDate(txs: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of txs) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  return groups;
}
