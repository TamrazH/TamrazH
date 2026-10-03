import { z } from "zod";
import { isValidISODate } from "./dates";

export const currencySchema = z.enum(["AZN", "USD"]);
export const accountCurrencySchema = z.enum(["AZN", "USD", "multi"]);
export const txTypeSchema = z.enum(["income", "expense", "transfer", "investment", "balance"]);
export const accountTypeSchema = z.enum([
  "bank", "card", "cash", "crypto", "deposit", "investment", "debtor", "creditor", "other",
]);

const MAX_AMOUNT = 1_000_000_000;
const isoDateTime = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Tarix/vaxt formatı yanlışdır");
const idSchema = z.string().min(1, "ID boş ola bilməz").max(100);

const amountSchema = z
  .number({ invalid_type_error: "Məbləğ rəqəm olmalıdır" })
  .finite("Məbləğ rəqəm olmalıdır")
  .positive("Məbləğ sıfırdan böyük olmalıdır")
  .max(MAX_AMOUNT, "Məbləğ çox böyükdür");

const dateSchema = z
  .string()
  .refine(isValidISODate, "Tarix düzgün deyil (YYYY-MM-DD)");

/** Tam Transaction (saxlanılan / sinxron olunan forma) */
export const transactionSchema = z
  .object({
    id: idSchema,
    date: dateSchema,
    accountId: idSchema,
    categoryId: idSchema,
    description: z.string().max(300, "Təsvir 300 simvoldan uzun ola bilməz"),
    amount: amountSchema,
    currency: currencySchema,
    type: txTypeSchema,
    toAccountId: idSchema.optional(),
    toAmount: amountSchema.optional(),
    direction: z.enum(["in", "out"]).optional(),
    notes: z.string().max(1000).optional(),
    attachmentUrl: z.string().max(2000).optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    deletedAt: isoDateTime.optional(),
  })
  .superRefine((tx, ctx) => {
    const needsTarget = tx.type === "transfer" || tx.type === "investment";
    if (needsTarget && !tx.toAccountId) {
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Hədəf hesab seçilməlidir" });
    }
    if (needsTarget && tx.toAccountId && tx.toAccountId === tx.accountId && tx.toAmount === undefined) {
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Mənbə və hədəf hesab fərqli olmalıdır" });
    }
    if (!needsTarget && (tx.toAccountId || tx.toAmount !== undefined)) {
      ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Hədəf hesab yalnız transfer/investisiya üçündür" });
    }
  });

export const accountSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1, "Hesab adı boş ola bilməz").max(80),
    type: accountTypeSchema,
    currency: accountCurrencySchema,
    openingBalance: z.number().finite().min(-MAX_AMOUNT).max(MAX_AMOUNT),
    openingBalanceUsd: z.number().finite().min(-MAX_AMOUNT).max(MAX_AMOUNT).optional(),
    isActive: z.boolean(),
    sortOrder: z.number().finite(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    deletedAt: isoDateTime.optional(),
  });

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "Kateqoriya adı boş ola bilməz").max(80),
  group: txTypeSchema,
  isActive: z.boolean(),
  sortOrder: z.number().finite(),
  icon: z.string().max(16).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Rəng #RRGGBB formatında olmalıdır")
    .optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional(),
});

/** POST /api/sheets/sync payload-ı */
export const syncPayloadSchema = z.object({
  transactions: z.array(transactionSchema).max(50_000),
  accounts: z.array(accountSchema).max(1_000),
  categories: z.array(categorySchema).max(1_000),
});

export type SyncPayload = z.infer<typeof syncPayloadSchema>;
