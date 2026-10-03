import type { Account, Category, Transaction, TransactionType } from "@/types";
import { round2, toAzn } from "./money";
import { monthKey, shiftMonth } from "./dates";
import { transactionEffects } from "./balances";

export interface Volume {
  AZN: number;
  USD: number;
  /** AZN + USD * məzənnə */
  eqAzn: number;
}

const emptyVolume = (): Volume => ({ AZN: 0, USD: 0, eqAzn: 0 });

function addVolume(v: Volume, amount: number, cur: "AZN" | "USD", rate: number) {
  v[cur] = round2(v[cur] + amount);
  v.eqAzn = round2(v.eqAzn + toAzn(amount, cur, rate));
}

export type MonthlySummary = Record<"income" | "expense" | "transfer" | "investment", Volume>;

export function summarizeMonth(txs: Transaction[], month: string, rate: number): MonthlySummary {
  const s: MonthlySummary = {
    income: emptyVolume(),
    expense: emptyVolume(),
    transfer: emptyVolume(),
    investment: emptyVolume(),
  };
  for (const t of txs) {
    if (t.deletedAt || monthKey(t.date) !== month || t.type === "balance") continue;
    addVolume(s[t.type], t.amount, t.currency, rate);
  }
  return s;
}

export interface MonthBar {
  month: string;
  income: number;
  expense: number;
}

/** Son N ayın gəlir/xərc (AZN ekvivalenti) */
export function lastMonthsBars(txs: Transaction[], endMonth: string, count: number, rate: number): MonthBar[] {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - (count - 1)));
  const idx = new Map(months.map((m, i) => [m, i]));
  const bars: MonthBar[] = months.map((month) => ({ month, income: 0, expense: 0 }));
  for (const t of txs) {
    if (t.deletedAt) continue;
    const i = idx.get(monthKey(t.date));
    if (i === undefined) continue;
    const bar = bars[i]!;
    if (t.type === "income") bar.income = round2(bar.income + toAzn(t.amount, t.currency, rate));
    else if (t.type === "expense") bar.expense = round2(bar.expense + toAzn(t.amount, t.currency, rate));
  }
  return bars;
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  value: number;
  percent: number;
}

export const SLICE_COLORS = [
  "#2f6fed", "#e11d48", "#f59e0b", "#16a34a", "#9333ea", "#0891b2", "#ea580c", "#db2777",
];
const OTHER_COLOR = "#94a3b8";

/** Xərc kateqoriyaları üzrə pay (AZN ekvivalenti); ən böyük 7 + "Digər" */
export function expenseByCategory(
  txs: Transaction[],
  categories: Category[],
  month: string,
  rate: number,
  maxSlices = 7,
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.deletedAt || t.type !== "expense" || monthKey(t.date) !== month) continue;
    totals.set(t.categoryId, round2((totals.get(t.categoryId) ?? 0) + toAzn(t.amount, t.currency, rate)));
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  const nameOf = (id: string) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return "Naməlum";
    const i = c.name.indexOf(": ");
    return i === -1 ? c.name : c.name.slice(i + 2);
  };
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, maxSlices);
  const tail = sorted.slice(maxSlices);
  const slices: CategorySlice[] = head.map(([id, value], i) => ({
    categoryId: id,
    name: nameOf(id),
    color: SLICE_COLORS[i % SLICE_COLORS.length]!,
    value,
    percent: (value / sum) * 100,
  }));
  if (tail.length) {
    const value = round2(tail.reduce((a, [, v]) => a + v, 0));
    slices.push({ categoryId: "__other", name: "Digər", color: OTHER_COLOR, value, percent: (value / sum) * 100 });
  }
  return slices;
}

export interface AccountMovement {
  accountId: string;
  name: string;
  inflow: number;
  outflow: number;
  net: number;
}

/** Ay ərzində hər hesabın daxil olan/çıxan hərəkəti (AZN ekvivalenti). Balans düzəlişləri daxildir. */
export function accountMovements(
  txs: Transaction[],
  accounts: Account[],
  month: string,
  rate: number,
): AccountMovement[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const acc = new Map<string, { inflow: number; outflow: number }>();
  for (const t of txs) {
    if (t.deletedAt || monthKey(t.date) !== month) continue;
    for (const e of transactionEffects(t, byId)) {
      const cur = acc.get(e.accountId) ?? { inflow: 0, outflow: 0 };
      const v = toAzn(Math.abs(e.delta), e.currency, rate);
      if (e.delta >= 0) cur.inflow = round2(cur.inflow + v);
      else cur.outflow = round2(cur.outflow + v);
      acc.set(e.accountId, cur);
    }
  }
  return [...acc.entries()]
    .map(([accountId, v]) => ({
      accountId,
      name: byId.get(accountId)?.name ?? "Naməlum hesab",
      inflow: v.inflow,
      outflow: v.outflow,
      net: round2(v.inflow - v.outflow),
    }))
    .sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow));
}

export type { TransactionType };
