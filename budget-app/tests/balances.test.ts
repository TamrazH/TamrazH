import { describe, expect, it } from "vitest";
import { computeBalances, computeTotals } from "@/lib/balances";
import { acc, tx } from "./helpers";

describe("computeBalances", () => {
  const accounts = [
    acc({ id: "cash", openingBalance: 100 }),
    acc({ id: "usd", currency: "USD", openingBalance: 50 }),
    acc({ id: "card", type: "card", currency: "multi", openingBalance: 10, openingBalanceUsd: 5 }),
    acc({ id: "debtor", type: "debtor", currency: "multi" }),
    acc({ id: "creditor", type: "creditor", currency: "multi" }),
  ];

  it("gəlir artırır, xərc azaldır", () => {
    const b = computeBalances(accounts, [
      tx({ type: "income", accountId: "cash", amount: 50 }),
      tx({ type: "expense", accountId: "cash", amount: 30.25 }),
    ]);
    expect(b.get("cash")).toEqual({ AZN: 119.75, USD: 0 });
  });

  it("float xətası yığılmır", () => {
    const txs = Array.from({ length: 10 }, () => tx({ type: "income", accountId: "cash", amount: 0.1 }));
    expect(computeBalances(accounts, txs).get("cash")?.AZN).toBe(101);
  });

  it("multi hesab valyutaları ayrıca saxlayır", () => {
    const b = computeBalances(accounts, [
      tx({ type: "expense", accountId: "card", amount: 4, currency: "USD" }),
      tx({ type: "income", accountId: "card", amount: 20, currency: "AZN" }),
    ]);
    expect(b.get("card")).toEqual({ AZN: 30, USD: 1 });
  });

  it("transfer: mənbə azalır, hədəf artır; cəm dəyişmir", () => {
    const txs = [tx({ type: "transfer", accountId: "cash", toAccountId: "card", amount: 40 })];
    const b = computeBalances(accounts, txs);
    expect(b.get("cash")?.AZN).toBe(60);
    expect(b.get("card")?.AZN).toBe(50);
    expect(computeTotals(accounts, b, 1.7).AZN).toBe(computeTotals(accounts, computeBalances(accounts, []), 1.7).AZN);
  });

  it("valyutalararası transfer toAmount istifadə edir", () => {
    const b = computeBalances(accounts, [
      tx({ type: "transfer", accountId: "cash", toAccountId: "usd", amount: 170, toAmount: 100 }),
    ]);
    expect(b.get("cash")?.AZN).toBe(-70);
    expect(b.get("usd")).toEqual({ AZN: 0, USD: 150 });
  });

  it("investisiya hesablar arası hərəkətdir", () => {
    const b = computeBalances(accounts, [
      tx({ type: "investment", accountId: "usd", toAccountId: "card", amount: 20, currency: "USD" }),
    ]);
    expect(b.get("usd")?.USD).toBe(30);
    expect(b.get("card")?.USD).toBe(25);
  });

  it("borc vermə/qaytarma və avans (işarəli debtor/creditor balansı)", () => {
    const txs = [
      tx({ type: "transfer", accountId: "cash", toAccountId: "debtor", amount: 60 }), // borc verdim
      tx({ type: "transfer", accountId: "debtor", toAccountId: "cash", amount: 20 }), // qismən qaytardı
      tx({ type: "transfer", accountId: "creditor", toAccountId: "cash", amount: 500 }), // avans aldım
      tx({ type: "transfer", accountId: "cash", toAccountId: "creditor", amount: 100 }), // avans qaytardım
    ];
    const b = computeBalances(accounts, txs);
    expect(b.get("debtor")?.AZN).toBe(40);
    expect(b.get("creditor")?.AZN).toBe(-400);
    const totals = computeTotals(accounts, b, 1.7);
    expect(totals.receivable.AZN).toBe(40);
    expect(totals.payable.AZN).toBe(400);
    // borc hesabları ümumi balansa daxil deyil
    expect(totals.AZN).toBe(100 + 10 - 60 + 20 + 500 - 100);
  });

  it("balans düzəlişi istiqamətə görə", () => {
    const b = computeBalances(accounts, [
      tx({ type: "balance", accountId: "cash", amount: 10, direction: "in" }),
      tx({ type: "balance", accountId: "cash", amount: 3, direction: "out" }),
      tx({ type: "balance", accountId: "usd", amount: 7, currency: "USD" }),
    ]);
    expect(b.get("cash")?.AZN).toBe(107);
    expect(b.get("usd")?.USD).toBe(57);
  });

  it("silinmiş (tombstone) əməliyyatlar nəzərə alınmır", () => {
    const b = computeBalances(accounts, [
      tx({ type: "expense", accountId: "cash", amount: 99, deletedAt: "2026-02-01T00:00:00.000Z" }),
    ]);
    expect(b.get("cash")?.AZN).toBe(100);
  });
});

describe("computeTotals", () => {
  it("ekvivalent məzənnə ilə, arxiv hesab xaric", () => {
    const accounts = [
      acc({ id: "a", openingBalance: 100 }),
      acc({ id: "u", currency: "USD", openingBalance: 100 }),
      acc({ id: "old", openingBalance: 999, isActive: false }),
    ];
    const t = computeTotals(accounts, computeBalances(accounts, []), 1.7);
    expect(t).toMatchObject({ AZN: 100, USD: 100, equivalentAzn: 270 });
  });
});
