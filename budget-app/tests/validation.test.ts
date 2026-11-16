import { describe, expect, it } from "vitest";
import { validateTransactionForm, type TransactionFormValues } from "@/lib/validation";
import { transactionSchema, syncPayloadSchema } from "@/lib/schemas";
import { acc, cat, tx } from "./helpers";

const ctx = {
  accounts: [
    acc({ id: "cash" }),
    acc({ id: "usd", currency: "USD" }),
    acc({ id: "card", currency: "multi" }),
    acc({ id: "old", isActive: false }),
  ],
  categories: [
    cat({ id: "food", group: "expense" }),
    cat({ id: "sal", group: "income" }),
    cat({ id: "tr", group: "transfer" }),
  ],
};

const base: TransactionFormValues = {
  type: "expense", date: "2026-03-10", accountId: "cash", toAccountId: "", categoryId: "food",
  description: " Çörək ", amount: "12,50", toAmount: "", currency: "AZN", direction: "in", notes: "",
};

describe("validateTransactionForm", () => {
  it("düzgün xərc", () => {
    const r = validateTransactionForm(base, ctx);
    expect(r).toEqual({
      ok: true,
      value: { type: "expense", date: "2026-03-10", accountId: "cash", categoryId: "food", description: "Çörək", amount: 12.5, currency: "AZN" },
    });
  });
  it("məbləğ boş / sıfır / mənfi / hərf", () => {
    for (const amount of ["", "0", "-5", "abc"]) {
      const r = validateTransactionForm({ ...base, amount }, ctx);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.amount).toBeTruthy();
    }
  });
  it("tarix yanlış", () => {
    const r = validateTransactionForm({ ...base, date: "2026-02-30" }, ctx);
    expect(r.ok === false && r.errors.date).toBeTruthy();
  });
  it("tək valyutalı hesaba yad valyuta qadağandır", () => {
    const r = validateTransactionForm({ ...base, currency: "USD" }, ctx);
    expect(r.ok === false && r.errors.accountId).toMatch(/yalnız AZN/);
  });
  it("multi hesab hər iki valyutanı qəbul edir", () => {
    expect(validateTransactionForm({ ...base, accountId: "card", currency: "USD" }, ctx).ok).toBe(true);
  });
  it("kateqoriya növə uyğun olmalıdır", () => {
    const r = validateTransactionForm({ ...base, categoryId: "sal" }, ctx);
    expect(r.ok === false && r.errors.categoryId).toBeTruthy();
  });
  it("arxiv hesab seçilə bilməz, amma redaktədə icazəlidir", () => {
    expect(validateTransactionForm({ ...base, accountId: "old" }, ctx).ok).toBe(false);
    expect(validateTransactionForm({ ...base, accountId: "old" }, { ...ctx, allowInactiveIds: ["old"] }).ok).toBe(true);
  });
  it("transfer hədəf hesab tələb edir və fərqli olmalıdır", () => {
    const t = { ...base, type: "transfer" as const, categoryId: "tr" };
    expect(validateTransactionForm(t, ctx).ok).toBe(false);
    expect(validateTransactionForm({ ...t, toAccountId: "cash" }, ctx).ok).toBe(false);
    expect(validateTransactionForm({ ...t, toAccountId: "card" }, ctx).ok).toBe(true);
  });
  it("valyutası fərqli hədəf üçün toAmount tələb olunur", () => {
    const t = { ...base, type: "transfer" as const, categoryId: "tr", toAccountId: "usd" };
    const r1 = validateTransactionForm(t, ctx);
    expect(r1.ok === false && r1.errors.toAmount).toBeTruthy();
    const r2 = validateTransactionForm({ ...t, toAmount: "7,35" }, ctx);
    expect(r2.ok && r2.value.toAmount).toBe(7.35);
  });
});

describe("zod şemaları (server validation)", () => {
  const good = {
    id: "t1", date: "2026-03-10", accountId: "a", categoryId: "c", description: "", amount: 5,
    currency: "AZN", type: "expense", createdAt: "2026-03-10T10:00:00.000Z", updatedAt: "2026-03-10T10:00:00.000Z",
  };
  it("düzgün əməliyyatı qəbul edir", () => {
    expect(transactionSchema.safeParse(good).success).toBe(true);
  });
  it.each([
    ["mənfi məbləğ", { amount: -1 }],
    ["sıfır məbləğ", { amount: 0 }],
    ["NaN", { amount: NaN }],
    ["yanlış valyuta", { currency: "EUR" }],
    ["yanlış növ", { type: "refund" }],
    ["yanlış tarix", { date: "10.03.2026" }],
    ["transfer hədəfsiz", { type: "transfer" }],
    ["xərcdə toAccountId", { toAccountId: "x" }],
  ])("rədd edir: %s", (_n, patch) => {
    expect(transactionSchema.safeParse({ ...good, ...patch }).success).toBe(false);
  });
  it("syncPayload boş massivləri qəbul edir, yanlış tipi rədd edir", () => {
    expect(syncPayloadSchema.safeParse({ transactions: [], accounts: [], categories: [] }).success).toBe(true);
    expect(syncPayloadSchema.safeParse({ transactions: "x" }).success).toBe(false);
  });
  it("helpers.tx istifadə olunur (lint)", () => {
    expect(tx({ type: "income", accountId: "a", amount: 1 }).amount).toBe(1);
  });
});
