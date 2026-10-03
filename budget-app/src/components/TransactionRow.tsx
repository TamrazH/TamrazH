"use client";

import type { Account, Category, Transaction } from "@/types";
import { formatMoney } from "@/lib/money";
import { GROUP_COLORS } from "@/lib/defaults";
import { TYPE_LABEL, shortCategoryName } from "@/lib/labels";

const TYPE_ICON = { income: "⬇️", expense: "⬆️", transfer: "🔁", investment: "📈", balance: "⚖️" } as const;

export function amountClass(t: Transaction): string {
  switch (t.type) {
    case "income":
      return "text-emerald-600 dark:text-emerald-400";
    case "expense":
      return "text-rose-600 dark:text-rose-400";
    case "investment":
      return "text-purple-600 dark:text-purple-400";
    case "transfer":
      return "text-brand-600 dark:text-brand-100";
    default:
      return "text-slate-600 dark:text-slate-300";
  }
}

export function signedAmount(t: Transaction): string {
  if (t.type === "income") return formatMoney(t.amount, t.currency, { showPlus: true });
  if (t.type === "expense") return formatMoney(-t.amount, t.currency);
  if (t.type === "balance") return formatMoney(t.direction === "out" ? -t.amount : t.amount, t.currency, { showPlus: true });
  return formatMoney(t.amount, t.currency);
}

export function TransactionRow({
  tx,
  accounts,
  categories,
  onClick,
}: {
  tx: Transaction;
  accounts: Map<string, Account>;
  categories: Map<string, Category>;
  onClick?: () => void;
}) {
  const cat = categories.get(tx.categoryId);
  const acc = accounts.get(tx.accountId);
  const to = tx.toAccountId ? accounts.get(tx.toAccountId) : undefined;
  const catName = cat ? shortCategoryName(cat) : "Silinmiş kateqoriya";
  const accName = acc?.name ?? "Silinmiş hesab";
  const title = tx.description || catName;
  const subtitle = to || tx.toAccountId ? `${accName} → ${to?.name ?? "Silinmiş hesab"}` : accName;
  const color = cat?.color ?? GROUP_COLORS[tx.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[60px] w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-slate-100 dark:active:bg-slate-800/60"
      aria-label={`${TYPE_LABEL[tx.type]}: ${title}, ${signedAmount(tx)}, ${accName}`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ backgroundColor: `${color}22` }}
        aria-hidden
      >
        {cat?.icon ?? TYPE_ICON[tx.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{title}</span>
        <span className="block truncate text-[13px] text-slate-500 dark:text-slate-400">
          {tx.description ? `${catName} · ` : ""}{subtitle}
        </span>
      </span>
      <span className={`num shrink-0 text-right text-[16px] font-bold ${amountClass(tx)}`}>
        {signedAmount(tx)}
        {tx.toAmount !== undefined && tx.toAccountId && (
          <span className="block text-[12px] font-medium opacity-70">→ {formatMoney(tx.toAmount, to && to.currency !== "multi" ? to.currency : tx.currency)}</span>
        )}
      </span>
    </button>
  );
}
