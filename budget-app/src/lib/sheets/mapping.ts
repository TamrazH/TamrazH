import type { Account, Category, Transaction } from "@/types";
import { accountSchema, categorySchema, transactionSchema } from "../schemas";

export const SHEET_NAMES = {
  transactions: "Transactions",
  accounts: "Accounts",
  categories: "Categories",
} as const;

export type Cell = string | number | boolean | null | undefined;
export type Row = Cell[];

/** Sheet-də "Hesab"/"Kateqoriya" sütunları insanlar üçündür; oxunarkən nəzərə alınmır. */
export const TRANSACTION_HEADERS = [
  "id", "date", "accountId", "categoryId", "description", "amount", "currency", "type",
  "toAccountId", "toAmount", "direction", "notes", "attachmentUrl",
  "createdAt", "updatedAt", "deletedAt", "accountName", "categoryName", "toAccountName",
] as const;

export const ACCOUNT_HEADERS = [
  "id", "name", "type", "currency", "openingBalance", "openingBalanceUsd",
  "isActive", "sortOrder", "createdAt", "updatedAt", "deletedAt",
] as const;

export const CATEGORY_HEADERS = [
  "id", "name", "group", "isActive", "sortOrder", "icon", "color",
  "createdAt", "updatedAt", "deletedAt",
] as const;

const blank = (v: Cell): v is undefined | null | "" => v === undefined || v === null || v === "";

/**
 * Formula injection-dan qorunma: "=", "+", "-", "@" ilə başlayan mətn hüceyrələri
 * RAW rejimində formula kimi icra olunmur, lakin Sheets-dən CSV ixrac edilərsə risk yaranır.
 * Yalnız mətn sahələrində apostrof prefiksi əlavə edirik və oxuyanda çıxarırıq.
 */
const FORMULA_START = /^[=+\-@]/;
function guardText(v: string | undefined): Cell {
  if (v === undefined) return "";
  return FORMULA_START.test(v) ? `'${v}` : v;
}
function unguardText(v: Cell): string | undefined {
  if (blank(v)) return undefined;
  const s = String(v);
  return s.startsWith("'") && FORMULA_START.test(s.slice(1)) ? s.slice(1) : s;
}

export function transactionToRow(
  t: Transaction,
  names: { account: (id: string) => string; category: (id: string) => string },
): Row {
  return [
    t.id, t.date, t.accountId, t.categoryId, guardText(t.description), t.amount, t.currency, t.type,
    t.toAccountId ?? "", t.toAmount ?? "", t.direction ?? "", guardText(t.notes), guardText(t.attachmentUrl),
    t.createdAt, t.updatedAt, t.deletedAt ?? "",
    guardText(names.account(t.accountId)),
    guardText(names.category(t.categoryId)),
    t.toAccountId ? guardText(names.account(t.toAccountId)) : "",
  ];
}

export function accountToRow(a: Account): Row {
  return [
    a.id, guardText(a.name), a.type, a.currency, a.openingBalance, a.openingBalanceUsd ?? "",
    a.isActive, a.sortOrder, a.createdAt, a.updatedAt, a.deletedAt ?? "",
  ];
}

export function categoryToRow(c: Category): Row {
  return [
    c.id, guardText(c.name), c.group, c.isActive, c.sortOrder, c.icon ?? "", c.color ?? "",
    c.createdAt, c.updatedAt, c.deletedAt ?? "",
  ];
}

function toRecord(headers: Cell[], row: Row): Record<string, Cell> {
  const rec: Record<string, Cell> = {};
  headers.forEach((h, i) => {
    if (typeof h === "string" && h) rec[h.trim()] = row[i];
  });
  return rec;
}

const num = (v: Cell): number | undefined => {
  if (blank(v)) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const bool = (v: Cell): boolean => v === true || String(v).toUpperCase() === "TRUE" || v === 1 || v === "1";

export interface ParseResult<T> {
  items: T[];
  /** Yanlış formatlı sətirlər (1-əsaslı sətir nömrələri, başlıq 1-dir) */
  invalidRows: number[];
}

function parseRows<T>(
  values: Row[] | undefined,
  build: (rec: Record<string, Cell>) => unknown,
  parse: (raw: unknown) => { success: boolean; data?: T },
): ParseResult<T> {
  const items: T[] = [];
  const invalidRows: number[] = [];
  if (!values || values.length < 2) return { items, invalidRows };
  const headers = values[0] ?? [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    if (row.every(blank)) continue;
    const res = parse(build(toRecord(headers, row)));
    if (res.success && res.data) items.push(res.data);
    else invalidRows.push(i + 1);
  }
  return { items, invalidRows };
}

/** Sheets-də tarix hüceyrəsi rəqəm (serial) kimi gələ bilər: 1899-12-30-dan gün sayı */
function dateCell(v: Cell): string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  return unguardText(v);
}

const opt = <T>(v: T | undefined): T | undefined => v;

export function parseTransactions(values: Row[] | undefined): ParseResult<Transaction> {
  return parseRows<Transaction>(
    values,
    (r) => ({
      id: unguardText(r.id),
      date: dateCell(r.date),
      accountId: unguardText(r.accountId),
      categoryId: unguardText(r.categoryId),
      description: unguardText(r.description) ?? "",
      amount: num(r.amount),
      currency: unguardText(r.currency),
      type: unguardText(r.type),
      toAccountId: opt(unguardText(r.toAccountId)),
      toAmount: num(r.toAmount),
      direction: opt(unguardText(r.direction)),
      notes: opt(unguardText(r.notes)),
      attachmentUrl: opt(unguardText(r.attachmentUrl)),
      createdAt: unguardText(r.createdAt),
      updatedAt: unguardText(r.updatedAt),
      deletedAt: opt(unguardText(r.deletedAt)),
    }),
    (raw) => {
      const p = transactionSchema.safeParse(raw);
      return p.success ? { success: true, data: p.data as Transaction } : { success: false };
    },
  );
}

export function parseAccounts(values: Row[] | undefined): ParseResult<Account> {
  return parseRows<Account>(
    values,
    (r) => ({
      id: unguardText(r.id),
      name: unguardText(r.name),
      type: unguardText(r.type),
      currency: unguardText(r.currency),
      openingBalance: num(r.openingBalance) ?? 0,
      openingBalanceUsd: num(r.openingBalanceUsd),
      isActive: bool(r.isActive),
      sortOrder: num(r.sortOrder) ?? 0,
      createdAt: unguardText(r.createdAt),
      updatedAt: unguardText(r.updatedAt),
      deletedAt: opt(unguardText(r.deletedAt)),
    }),
    (raw) => {
      const p = accountSchema.safeParse(raw);
      return p.success ? { success: true, data: p.data as Account } : { success: false };
    },
  );
}

export function parseCategories(values: Row[] | undefined): ParseResult<Category> {
  return parseRows<Category>(
    values,
    (r) => ({
      id: unguardText(r.id),
      name: unguardText(r.name),
      group: unguardText(r.group),
      isActive: bool(r.isActive),
      sortOrder: num(r.sortOrder) ?? 0,
      icon: opt(unguardText(r.icon)),
      color: opt(unguardText(r.color)),
      createdAt: unguardText(r.createdAt),
      updatedAt: unguardText(r.updatedAt),
      deletedAt: opt(unguardText(r.deletedAt)),
    }),
    (raw) => {
      const p = categorySchema.safeParse(raw);
      return p.success ? { success: true, data: p.data as Category } : { success: false };
    },
  );
}
