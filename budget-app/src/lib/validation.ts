import type { Account, Category, Currency, Direction, TransactionType } from "@/types";
import { isValidISODate } from "./dates";
import { parseAmount, round2 } from "./money";

/** Formdan gələn xam dəyərlər */
export interface TransactionFormValues {
  type: TransactionType;
  date: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  description: string;
  amount: string;
  toAmount: string;
  currency: Currency;
  direction: Direction;
  notes: string;
}

export interface TransactionInput {
  type: TransactionType;
  date: string;
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  description: string;
  amount: number;
  toAmount?: number;
  currency: Currency;
  direction?: Direction;
  notes?: string;
}

export type FieldErrors = Partial<Record<keyof TransactionFormValues, string>>;

export interface ValidationContext {
  accounts: Account[];
  categories: Category[];
  /** Redaktə zamanı: arxivləşdirilmiş hesab/kateqoriya mövcud əməliyyatda icazəlidir */
  allowInactiveIds?: string[];
}

export type ValidationResult =
  | { ok: true; value: TransactionInput }
  | { ok: false; errors: FieldErrors };

/** Hədəf hesaba düşən valyuta: tək valyutalı hesab -> öz valyutası, multi -> əməliyyatın valyutası */
export function destinationCurrency(account: Account, txCurrency: Currency): Currency {
  return account.currency === "multi" ? txCurrency : account.currency;
}

export function validateTransactionForm(
  v: TransactionFormValues,
  ctx: ValidationContext,
): ValidationResult {
  const errors: FieldErrors = {};
  const allowed = new Set(ctx.allowInactiveIds ?? []);
  const findAcc = (id: string) => ctx.accounts.find((a) => a.id === id && !a.deletedAt);

  if (!isValidISODate(v.date)) errors.date = "Tarix düzgün deyil";

  const amount = parseAmount(v.amount);
  if (!v.amount.trim()) errors.amount = "Məbləği daxil edin";
  else if (!Number.isFinite(amount)) errors.amount = "Məbləğ düzgün rəqəm deyil";
  else if (amount <= 0) errors.amount = "Məbləğ sıfırdan böyük olmalıdır";
  else if (amount > 1_000_000_000) errors.amount = "Məbləğ çox böyükdür";

  if (v.description.length > 300) errors.description = "Təsvir 300 simvoldan uzun ola bilməz";

  const acc = findAcc(v.accountId);
  if (!v.accountId) errors.accountId = "Hesab seçin";
  else if (!acc) errors.accountId = "Seçilmiş hesab tapılmadı";
  else if (!acc.isActive && !allowed.has(acc.id)) errors.accountId = "Bu hesab arxivdədir";
  else if (acc.currency !== "multi" && acc.currency !== v.currency) {
    errors.accountId = `"${acc.name}" yalnız ${acc.currency} qəbul edir. Valyutanı dəyişin və ya hesabı "AZN + USD" edin`;
  }

  const cat = ctx.categories.find((c) => c.id === v.categoryId && !c.deletedAt);
  if (!v.categoryId) errors.categoryId = "Kateqoriya seçin";
  else if (!cat) errors.categoryId = "Seçilmiş kateqoriya tapılmadı";
  else if (cat.group !== v.type) errors.categoryId = "Kateqoriya seçilmiş əməliyyat növünə uyğun deyil";
  else if (!cat.isActive && !allowed.has(cat.id)) errors.categoryId = "Bu kateqoriya arxivdədir";

  let toAmount: number | undefined;
  if (v.type === "transfer" || v.type === "investment") {
    const to = findAcc(v.toAccountId);
    if (!v.toAccountId) errors.toAccountId = "Hədəf hesabı seçin";
    else if (!to) errors.toAccountId = "Hədəf hesab tapılmadı";
    else if (v.toAccountId === v.accountId) errors.toAccountId = "Mənbə və hədəf hesab fərqli olmalıdır";
    else if (!to.isActive && !allowed.has(to.id)) errors.toAccountId = "Hədəf hesab arxivdədir";
    else {
      const destCur = destinationCurrency(to, v.currency);
      if (destCur !== v.currency) {
        const parsed = parseAmount(v.toAmount);
        if (!v.toAmount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
          errors.toAmount = `Hədəf hesab ${destCur} valyutasındadır — hədəfə düşən məbləği daxil edin`;
        } else toAmount = round2(parsed);
      }
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const value: TransactionInput = {
    type: v.type,
    date: v.date,
    accountId: v.accountId,
    categoryId: v.categoryId,
    description: v.description.trim(),
    amount: round2(amount),
    currency: v.currency,
  };
  if (v.type === "transfer" || v.type === "investment") {
    value.toAccountId = v.toAccountId;
    if (toAmount !== undefined) value.toAmount = toAmount;
  }
  if (v.type === "balance") value.direction = v.direction;
  const notes = v.notes.trim();
  if (notes) value.notes = notes;
  return { ok: true, value };
}
