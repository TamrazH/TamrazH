import type {
  Account,
  AccountType,
  Category,
  CategoryGroup,
  TransactionType,
} from "@/types";

export const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Xərc",
  income: "Gəlir",
  transfer: "Transfer",
  investment: "İnvestisiya",
  balance: "Balans",
};

export const GROUP_LABEL: Record<CategoryGroup, string> = TYPE_LABEL;

export const TX_TYPES: TransactionType[] = [
  "expense",
  "income",
  "transfer",
  "investment",
  "balance",
];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: "Bank",
  card: "Kart",
  cash: "Nağd",
  crypto: "Kripto",
  deposit: "Depozit",
  investment: "İnvestisiya",
  debtor: "Borclular (mənə borclu)",
  creditor: "Kreditorlar (mən borcluyam)",
  other: "Digər",
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "cash",
  "card",
  "bank",
  "deposit",
  "investment",
  "crypto",
  "debtor",
  "creditor",
  "other",
];

export const ACCOUNT_TYPES = ACCOUNT_TYPE_ORDER;

export const CURRENCY_LABEL = { AZN: "AZN (₼)", USD: "USD ($)", multi: "AZN + USD" } as const;

/** "Xərc: Ərzaq" -> "Ərzaq" (qrup prefiksi çıxarılır) */
export function shortCategoryName(cat: Pick<Category, "name">): string {
  const idx = cat.name.indexOf(": ");
  return idx === -1 ? cat.name : cat.name.slice(idx + 2);
}

export function isDebtAccount(acc: Pick<Account, "type">): boolean {
  return acc.type === "debtor" || acc.type === "creditor";
}
