import type { Account, Balance, Currency, Transaction } from "@/types";
import { fromCents, toAzn, toCents } from "./money";

export interface Effect {
  accountId: string;
  currency: Currency;
  /** İşarəli dəyişiklik (+ artır, − azaldır) */
  delta: number;
}

/**
 * Əməliyyatın hesablara təsiri — balans məntiqinin TƏK mənbəyi.
 *  income      : hesab +amount
 *  expense     : hesab −amount
 *  transfer    : mənbə −amount, hədəf +toAmount (yoxdursa amount)
 *  investment  : transfer ilə eyni (hesablar arası hərəkət), analitikada ayrıca sayılır
 *  balance     : direction="out" -> −amount, əks halda +amount
 *
 * Debtor/Creditor hesabları işarəli balans saxlayır:
 *   müsbət = mənə borcludur, mənfi = mən borcluyam.
 *   Borc vermə:  Nağd -> Debtor  (Nağd −, Debtor +)
 *   Borc qaytarma: Debtor -> Nağd
 *   Avans alma:  Creditor -> Kart (Creditor −: mən borcluyam)
 *   Avans qaytarma: Kart -> Creditor (Creditor −dan 0-a doğru)
 */
export function transactionEffects(
  tx: Transaction,
  accountsById: Map<string, Account>,
): Effect[] {
  switch (tx.type) {
    case "income":
      return [{ accountId: tx.accountId, currency: tx.currency, delta: tx.amount }];
    case "expense":
      return [{ accountId: tx.accountId, currency: tx.currency, delta: -tx.amount }];
    case "balance":
      return [
        {
          accountId: tx.accountId,
          currency: tx.currency,
          delta: tx.direction === "out" ? -tx.amount : tx.amount,
        },
      ];
    case "transfer":
    case "investment": {
      const effects: Effect[] = [
        { accountId: tx.accountId, currency: tx.currency, delta: -tx.amount },
      ];
      if (tx.toAccountId) {
        const to = accountsById.get(tx.toAccountId);
        const destCurrency: Currency =
          to && to.currency !== "multi" ? to.currency : tx.currency;
        effects.push({
          accountId: tx.toAccountId,
          currency: destCurrency,
          delta: tx.toAmount ?? tx.amount,
        });
      }
      return effects;
    }
  }
}

export function openingBalanceOf(acc: Account): Balance {
  if (acc.currency === "USD") return { AZN: 0, USD: acc.openingBalance };
  if (acc.currency === "AZN") return { AZN: acc.openingBalance, USD: 0 };
  return { AZN: acc.openingBalance, USD: acc.openingBalanceUsd ?? 0 };
}

/** Bütün hesabların cari balansı (silinmiş əməliyyatlar nəzərə alınmır). Sentlə hesablanır. */
export function computeBalances(
  accounts: Account[],
  transactions: Transaction[],
): Map<string, Balance> {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const cents = new Map<string, { AZN: number; USD: number }>();
  for (const acc of accounts) {
    const ob = openingBalanceOf(acc);
    cents.set(acc.id, { AZN: toCents(ob.AZN), USD: toCents(ob.USD) });
  }
  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    for (const e of transactionEffects(tx, byId)) {
      const bucket = cents.get(e.accountId);
      if (!bucket) continue; // silinmiş/naməlum hesab
      bucket[e.currency] += toCents(e.delta);
    }
  }
  const out = new Map<string, Balance>();
  for (const [id, c] of cents) out.set(id, { AZN: fromCents(c.AZN), USD: fromCents(c.USD) });
  return out;
}

export interface Totals {
  /** Borc hesabları xaric, aktiv hesabların cəmi */
  AZN: number;
  USD: number;
  /** AZN + USD * məzənnə */
  equivalentAzn: number;
  /** Mənə borclu olanların cəmi (AZN ekvivalenti) */
  receivableAzn: number;
  /** Mənim borclu olduğum məbləğ (AZN ekvivalenti, müsbət ədəd) */
  payableAzn: number;
  receivable: Balance;
  payable: Balance;
}

export function computeTotals(
  accounts: Account[],
  balances: Map<string, Balance>,
  usdRate: number,
): Totals {
  let azn = 0, usd = 0;
  const recv = { AZN: 0, USD: 0 };
  const pay = { AZN: 0, USD: 0 };
  for (const acc of accounts) {
    if (acc.deletedAt || !acc.isActive) continue;
    const b = balances.get(acc.id);
    if (!b) continue;
    if (acc.type === "debtor" || acc.type === "creditor") {
      // Hər valyutada ayrıca: müsbət -> alacaq, mənfi -> borc
      for (const cur of ["AZN", "USD"] as const) {
        const v = b[cur];
        if (v > 0) recv[cur] += v;
        else if (v < 0) pay[cur] += -v;
      }
    } else {
      azn += b.AZN;
      usd += b.USD;
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    AZN: r(azn),
    USD: r(usd),
    equivalentAzn: r(azn + toAzn(usd, "USD", usdRate)),
    receivableAzn: r(recv.AZN + toAzn(recv.USD, "USD", usdRate)),
    payableAzn: r(pay.AZN + toAzn(pay.USD, "USD", usdRate)),
    receivable: { AZN: r(recv.AZN), USD: r(recv.USD) },
    payable: { AZN: r(pay.AZN), USD: r(pay.USD) },
  };
}
