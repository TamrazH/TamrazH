import type { Account, Category, Transaction } from "@/types";

const T = "2026-01-01T00:00:00.000Z";

export function acc(partial: Partial<Account> & { id: string }): Account {
  return {
    name: partial.id,
    type: "cash",
    currency: "AZN",
    openingBalance: 0,
    isActive: true,
    sortOrder: 0,
    createdAt: T,
    updatedAt: T,
    ...partial,
  };
}

export function cat(partial: Partial<Category> & { id: string }): Category {
  return {
    name: partial.id,
    group: "expense",
    isActive: true,
    sortOrder: 0,
    createdAt: T,
    updatedAt: T,
    ...partial,
  };
}

let n = 0;
export function tx(partial: Partial<Transaction> & Pick<Transaction, "type" | "accountId" | "amount">): Transaction {
  n++;
  return {
    id: `tx-${n}`,
    date: "2026-03-10",
    categoryId: "c1",
    description: "",
    currency: "AZN",
    createdAt: T,
    updatedAt: T,
    ...partial,
  };
}
