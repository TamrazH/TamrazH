"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import type { Account, Currency, Direction, Transaction, TransactionType } from "@/types";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { todayISO } from "@/lib/dates";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_ORDER, TX_TYPES, TYPE_LABEL, shortCategoryName, isDebtAccount } from "@/lib/labels";
import { destinationCurrency, validateTransactionForm, type FieldErrors, type TransactionFormValues } from "@/lib/validation";
import { Field, Segmented } from "./ui";

function formatForInput(n: number | undefined): string {
  return n === undefined ? "" : String(n).replace(".", ",");
}

function valuesFromTransaction(t: Transaction): TransactionFormValues {
  return {
    type: t.type,
    date: t.date,
    accountId: t.accountId,
    toAccountId: t.toAccountId ?? "",
    categoryId: t.categoryId,
    description: t.description,
    amount: formatForInput(t.amount),
    toAmount: formatForInput(t.toAmount),
    currency: t.currency,
    direction: t.direction ?? "in",
    notes: t.notes ?? "",
  };
}

const ACCOUNT_LABEL: Record<TransactionType, string> = {
  expense: "Hesab",
  income: "Hesab",
  transfer: "Haradan (mənbə hesab)",
  investment: "Haradan (mənbə hesab)",
  balance: "Hesab",
};

function AccountOptions({ accounts, keepIds }: { accounts: Account[]; keepIds: string[] }) {
  const visible = accounts.filter((a) => a.isActive || keepIds.includes(a.id));
  return (
    <>
      {ACCOUNT_TYPE_ORDER.map((type) => {
        const list = visible.filter((a) => a.type === type);
        if (list.length === 0) return null;
        return (
          <optgroup key={type} label={ACCOUNT_TYPE_LABEL[type]}>
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.isActive ? "" : " (arxiv)"}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

export function TransactionForm({
  initial,
  presetType,
  onSaved,
  submitLabel,
}: {
  initial?: Transaction;
  presetType?: TransactionType;
  onSaved?: (tx: Transaction | null) => void;
  submitLabel?: string;
}) {
  const store = useStore();
  const toast = useToast();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const formRef = useRef<HTMLFormElement>(null);
  const editing = Boolean(initial);

  const makeDefaults = (type: TransactionType, date = todayISO()): TransactionFormValues => {
    const last = store.settings.lastUsed[type];
    const activeIds = new Set(store.accounts.filter((a) => a.isActive).map((a) => a.id));
    const catOk = (cid?: string) =>
      cid && store.categories.some((c) => c.id === cid && c.isActive && c.group === type) ? cid : "";
    return {
      type,
      date,
      accountId: last?.accountId && activeIds.has(last.accountId) ? last.accountId : "",
      toAccountId: last?.toAccountId && activeIds.has(last.toAccountId) ? last.toAccountId : "",
      categoryId: catOk(last?.categoryId),
      description: "",
      amount: "",
      toAmount: "",
      currency: last?.currency ?? "AZN",
      direction: "in",
      notes: "",
    };
  };

  const [values, setValues] = useState<TransactionFormValues>(() =>
    initial ? valuesFromTransaction(initial) : makeDefaults(presetType ?? "expense"),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showNotes, setShowNotes] = useState(Boolean(initial?.notes));
  const [saving, setSaving] = useState(false);

  // Mağaza yüklənəndən sonra (ilk açılışda) son istifadə olunanları tətbiq et
  const appliedDefaults = useRef(editing);
  useEffect(() => {
    if (appliedDefaults.current || !store.ready) return;
    appliedDefaults.current = true;
    setValues((v) => ({ ...makeDefaults(v.type, v.date), amount: v.amount, description: v.description }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready]);

  const set = <K extends keyof TransactionFormValues>(k: K, v: TransactionFormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const account = store.accounts.find((a) => a.id === values.accountId);
  const toAccount = store.accounts.find((a) => a.id === values.toAccountId);
  const lockedCurrency: Currency | null = account && account.currency !== "multi" ? account.currency : null;
  const currency: Currency = lockedCurrency ?? values.currency;
  const isTransferLike = values.type === "transfer" || values.type === "investment";
  const destCur = toAccount ? destinationCurrency(toAccount, currency) : currency;
  const needsToAmount = isTransferLike && Boolean(toAccount) && destCur !== currency;

  const keepIds = [initial?.accountId, initial?.toAccountId].filter(Boolean) as string[];
  const typeCategories = useMemo(
    () =>
      store.categories.filter(
        (c) => c.group === values.type && (c.isActive || c.id === initial?.categoryId),
      ),
    [store.categories, values.type, initial?.categoryId],
  );

  // Növ üzrə yalnız bir kateqoriya varsa (məs. "Balans") avtomatik seç
  useEffect(() => {
    if (!values.categoryId && typeCategories.length === 1) {
      setValues((v) => ({ ...v, categoryId: typeCategories[0]!.id }));
    }
  }, [typeCategories, values.categoryId]);

  const recentDescriptions = useMemo(() => {
    const seen = new Set<string>();
    for (const t of store.transactions) {
      if (t.description && !seen.has(t.description)) seen.add(t.description);
      if (seen.size >= 30) break;
    }
    return [...seen];
  }, [store.transactions]);

  const changeType = (type: TransactionType) => {
    if (type === values.type) return;
    const d = makeDefaults(type, values.date);
    setValues((v) => ({
      ...v,
      type,
      categoryId: d.categoryId,
      // Hesabı saxla (əgər növ üçün son seçim yoxdursa)
      accountId: d.accountId || v.accountId,
      toAccountId: type === "transfer" || type === "investment" ? d.toAccountId : "",
      toAmount: "",
    }));
    setErrors({});
  };

  useEffect(() => {
    const first = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [errors]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const res = validateTransactionForm(
      { ...values, currency },
      {
        accounts: store.accounts,
        categories: store.categories,
        allowInactiveIds: [initial?.accountId, initial?.toAccountId, initial?.categoryId].filter(Boolean) as string[],
      },
    );
    if (!res.ok) {
      setErrors(res.errors);
      toast.error("Formu yoxlayın: bəzi sahələr düzgün deyil");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        store.updateTransaction(initial.id, res.value);
        toast.success("Dəyişikliklər yadda saxlandı");
        onSaved?.(null);
      } else {
        const tx = store.addTransaction(res.value);
        toast.success("Əməliyyat yadda saxlandı ✓");
        // Yeni əməliyyat üçün hazır forma: tarix, hesab, kateqoriya qalır; məbləğ və təsvir təmizlənir
        setValues((v) => ({ ...v, amount: "", toAmount: "", description: "", notes: "" }));
        setShowNotes(false);
        setErrors({});
        window.scrollTo({ top: 0, behavior: "smooth" });
        onSaved?.(tx);
      }
    } finally {
      setSaving(false);
    }
  };

  const directionOptions: { value: Direction; label: string }[] = [
    { value: "in", label: "Qalığı artır (+)" },
    { value: "out", label: "Qalığı azalt (−)" },
  ];

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4" aria-label={editing ? "Əməliyyatı redaktə et" : "Yeni əməliyyat"}>
      <Segmented
        label="Əməliyyat növü"
        value={values.type}
        onChange={changeType}
        options={TX_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
      />

      {values.type === "balance" && (
        <Segmented label="Balans düzəlişi istiqaməti" value={values.direction} onChange={(v) => set("direction", v)} options={directionOptions} />
      )}

      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <Field label="Məbləğ" htmlFor={id("amount")} error={errors.amount}>
          <input
            id={id("amount")}
            className="input num !text-[22px] font-bold"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            enterKeyHint="next"
            value={values.amount}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? `${id("amount")}-error` : undefined}
            onChange={(e) => set("amount", e.target.value.replace(/[^0-9.,\s]/g, ""))}
          />
        </Field>
        <div>
          <span className="label" id={id("cur-label")}>Valyuta</span>
          <div
            role="radiogroup"
            aria-labelledby={id("cur-label")}
            className="grid h-[48px] grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800"
          >
            {(["AZN", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                disabled={Boolean(lockedCurrency) && lockedCurrency !== c}
                onClick={() => set("currency", c)}
                className={`min-w-[52px] rounded-lg text-[14px] font-bold transition disabled:opacity-40 ${
                  currency === c ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Field label={ACCOUNT_LABEL[values.type]} htmlFor={id("account")} error={errors.accountId}>
        <select
          id={id("account")}
          className="input"
          value={values.accountId}
          aria-invalid={Boolean(errors.accountId)}
          aria-describedby={errors.accountId ? `${id("account")}-error` : undefined}
          onChange={(e) => set("accountId", e.target.value)}
        >
          <option value="">Hesab seçin…</option>
          <AccountOptions accounts={store.accounts} keepIds={keepIds} />
        </select>
      </Field>

      {isTransferLike && (
        <>
          <Field label="Hara (hədəf hesab)" htmlFor={id("to")} error={errors.toAccountId}>
            <select
              id={id("to")}
              className="input"
              value={values.toAccountId}
              aria-invalid={Boolean(errors.toAccountId)}
              aria-describedby={errors.toAccountId ? `${id("to")}-error` : undefined}
              onChange={(e) => set("toAccountId", e.target.value)}
            >
              <option value="">Hədəf hesabı seçin…</option>
              <AccountOptions accounts={store.accounts.filter((a) => a.id !== values.accountId)} keepIds={keepIds} />
            </select>
          </Field>
          {toAccount && isDebtAccount(toAccount) && (
            <p className="-mt-2 text-[12px] text-slate-500 dark:text-slate-400">
              {toAccount.type === "debtor" ? "Borclu hesabı: müsbət balans = o, sizə borcludur." : "Kreditor hesabı: mənfi balans = siz ona borcludur."}
            </p>
          )}
          {needsToAmount && (
            <Field label={`Hədəfə düşən məbləğ (${destCur})`} htmlFor={id("toamount")} error={errors.toAmount}>
              <input
                id={id("toamount")}
                className="input num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={values.toAmount}
                aria-invalid={Boolean(errors.toAmount)}
                aria-describedby={errors.toAmount ? `${id("toamount")}-error` : undefined}
                onChange={(e) => set("toAmount", e.target.value.replace(/[^0-9.,\s]/g, ""))}
              />
            </Field>
          )}
        </>
      )}

      {!(values.type === "balance" && typeCategories.length === 1) ? (
        <Field label="Kateqoriya" htmlFor={id("cat")} error={errors.categoryId}>
          <select
            id={id("cat")}
            className="input"
            value={values.categoryId}
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby={errors.categoryId ? `${id("cat")}-error` : undefined}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            <option value="">Kateqoriya seçin…</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}{shortCategoryName(c)}
                {c.isActive ? "" : " (arxiv)"}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Təsvir" htmlFor={id("desc")} error={errors.description}>
        <input
          id={id("desc")}
          className="input"
          list={id("desc-list")}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          placeholder="Məs.: Bazarlıq"
          value={values.description}
          maxLength={300}
          onChange={(e) => set("description", e.target.value)}
        />
        <datalist id={id("desc-list")}>
          {recentDescriptions.map((d) => <option key={d} value={d} />)}
        </datalist>
      </Field>

      <Field label="Tarix" htmlFor={id("date")} error={errors.date}>
        <input
          id={id("date")}
          type="date"
          className="input"
          value={values.date}
          aria-invalid={Boolean(errors.date)}
          onChange={(e) => set("date", e.target.value)}
        />
      </Field>

      {showNotes ? (
        <Field label="Qeyd" htmlFor={id("notes")}>
          <textarea
            id={id("notes")}
            className="input min-h-[88px] py-3"
            rows={3}
            maxLength={1000}
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="min-h-[44px] text-[15px] font-semibold text-brand-500">
          + Qeyd əlavə et
        </button>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {submitLabel ?? (editing ? "Yadda saxla" : "Əməliyyatı əlavə et")}
      </button>
    </form>
  );
}
