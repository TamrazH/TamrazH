"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Account,
  Balance,
  Category,
  Settings,
  Snapshot,
  SyncMeta,
  Transaction,
} from "@/types";
import { computeBalances, computeTotals, type Totals } from "@/lib/balances";
import { SEED_TIME, defaultSettings } from "@/lib/defaults";
import { newId } from "@/lib/ids";
import { mergeById } from "@/lib/merge";
import { sortTransactions } from "@/lib/filters";
import { transactionSchema, accountSchema, categorySchema } from "@/lib/schemas";
import type { TransactionInput } from "@/lib/validation";
import { LocalStorageRepository, STORAGE_KEYS, type Repository } from "@/services/repository";
import { pickStorage } from "@/services/memory-storage";
import { pushSync } from "@/services/sync-client";
import { useOnline } from "./useOnline";
import { useToast } from "./useToast";
import { z } from "zod";

const nowISO = () => new Date().toISOString();

export type AccountDraft = Pick<Account, "name" | "type" | "currency" | "openingBalance" | "isActive"> & {
  openingBalanceUsd?: number;
};
export type CategoryDraft = Pick<Category, "name" | "group" | "isActive"> & { icon?: string; color?: string };

export type DeleteResult = { ok: true } | { ok: false; reason: "in-use"; count: number };

interface State {
  ready: boolean;
  persistent: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  settings: Settings;
  sync: SyncMeta;
}

export interface StoreApi {
  ready: boolean;
  /** false olduqda məlumat yalnız cari sessiya üçün saxlanılır (localStorage bloklanıb) */
  persistent: boolean;
  /** Silinməmiş, sortOrder üzrə */
  accounts: Account[];
  categories: Category[];
  /** Silinməmiş, tarixə görə yeni -> köhnə */
  transactions: Transaction[];
  settings: Settings;
  balances: Map<string, Balance>;
  totals: Totals;
  sync: SyncMeta;
  pendingChanges: number;
  addTransaction: (input: TransactionInput) => Transaction;
  updateTransaction: (id: string, input: TransactionInput) => void;
  deleteTransaction: (id: string) => void;
  saveAccount: (id: string | null, draft: AccountDraft) => Account;
  archiveAccount: (id: string, archived: boolean) => void;
  deleteAccount: (id: string) => DeleteResult;
  accountUsage: (id: string) => number;
  saveCategory: (id: string | null, draft: CategoryDraft) => Category;
  archiveCategory: (id: string, archived: boolean) => void;
  deleteCategory: (id: string) => DeleteResult;
  categoryUsage: (id: string) => number;
  updateSettings: (patch: Partial<Settings>) => void;
  syncNow: () => Promise<boolean>;
  reload: () => Promise<void>;
  exportBackup: () => string;
  importBackup: (json: string) => { ok: true; added: number } | { ok: false; error: string };
}

const StoreContext = createContext<StoreApi | null>(null);

const INITIAL: State = {
  ready: false,
  persistent: true,
  accounts: [],
  categories: [],
  transactions: [],
  settings: defaultSettings(),
  sync: { state: "idle" },
};

const backupSchema = z.object({
  version: z.literal(1),
  transactions: z.array(transactionSchema),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  const repoRef = useRef<Repository | null>(null);
  const persisted = useRef<Partial<Record<"tx" | "acc" | "cat" | "set", unknown>>>({});
  const syncing = useRef(false);
  const blockedUntil = useRef(0);
  const [retryTick, setRetryTick] = useState(0);
  const online = useOnline();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  /* ---------- Yükləmə ---------- */
  const load = useCallback(async () => {
    const repo = repoRef.current;
    if (!repo) return;
    const { snapshot, settings } = await repo.load();
    const meta = await repo.loadSyncMeta();
    persisted.current = {
      tx: snapshot.transactions,
      acc: snapshot.accounts,
      cat: snapshot.categories,
      set: settings,
    };
    setState((s) => ({
      ...s,
      ready: true,
      accounts: snapshot.accounts,
      categories: snapshot.categories,
      transactions: snapshot.transactions,
      settings,
      sync: { ...s.sync, lastSyncAt: meta.lastSyncAt },
    }));
  }, []);

  useEffect(() => {
    const { storage, persistent } = pickStorage();
    repoRef.current = new LocalStorageRepository(storage);
    persisted.current = {}; // ilk yükləmədə hər şey yazılsın (seed daxil)
    void load().then(() => {
      persisted.current = {};
      setState((s) => ({ ...s, persistent }));
    });
    if (!persistent) {
      toastRef.current.error("Brauzer yaddaşı əlçatmazdır — məlumat yalnız bu sessiya üçün saxlanılacaq.");
    }
    // Başqa tab-da dəyişiklik
    const onStorage = (e: StorageEvent) => {
      if (e.key && Object.values(STORAGE_KEYS).includes(e.key as never)) void load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  /* ---------- Saxlama ---------- */
  useEffect(() => {
    if (!state.ready) return;
    const repo = repoRef.current;
    if (!repo) return;
    const p = persisted.current;
    const jobs: Promise<void>[] = [];
    if (p.tx !== state.transactions) jobs.push(repo.saveTransactions(state.transactions));
    if (p.acc !== state.accounts) jobs.push(repo.saveAccounts(state.accounts));
    if (p.cat !== state.categories) jobs.push(repo.saveCategories(state.categories));
    if (p.set !== state.settings) jobs.push(repo.saveSettings(state.settings));
    if (jobs.length === 0) return;
    persisted.current = {
      tx: state.transactions,
      acc: state.accounts,
      cat: state.categories,
      set: state.settings,
    };
    Promise.all(jobs).catch((e: unknown) => {
      toastRef.current.error(e instanceof Error ? e.message : "Məlumat saxlanıla bilmədi.");
      persisted.current = {}; // növbəti dəyişiklikdə yenidən cəhd
    });
  }, [state.ready, state.transactions, state.accounts, state.categories, state.settings]);

  /* ---------- Əməliyyat CRUD ---------- */
  const rememberLastUsed = useCallback((input: TransactionInput, settings: Settings): Settings => ({
    ...settings,
    lastUsed: {
      ...settings.lastUsed,
      [input.type]: {
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        categoryId: input.categoryId,
        currency: input.currency,
      },
    },
  }), []);

  const addTransaction = useCallback((input: TransactionInput): Transaction => {
    const now = nowISO();
    const tx: Transaction = { id: newId(), ...input, createdAt: now, updatedAt: now };
    setState((s) => ({
      ...s,
      transactions: [...s.transactions, tx],
      settings: rememberLastUsed(input, s.settings),
    }));
    return tx;
  }, [rememberLastUsed]);

  const updateTransaction = useCallback((id: string, input: TransactionInput) => {
    const now = nowISO();
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t;
        // Növ dəyişəndə köhnə növə aid sahələr qalmasın
        const { toAccountId: _a, toAmount: _b, direction: _c, notes: _d, ...rest } = t;
        void _a; void _b; void _c; void _d;
        return { ...rest, ...input, updatedAt: now };
      }),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    const now = nowISO();
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t)),
    }));
  }, []);

  /* ---------- Hesab CRUD ---------- */
  const accountUsage = useCallback(
    (id: string) =>
      stateRef.current.transactions.filter((t) => !t.deletedAt && (t.accountId === id || t.toAccountId === id)).length,
    [],
  );

  const saveAccount = useCallback((id: string | null, draft: AccountDraft): Account => {
    const now = nowISO();
    const cur = stateRef.current;
    const existing = id ? cur.accounts.find((a) => a.id === id) : undefined;
    const maxOrder = cur.accounts.reduce((m, a) => Math.max(m, a.sortOrder), 0);
    const result: Account = existing
      ? { ...existing, ...draft, updatedAt: now }
      : { id: newId(), ...draft, sortOrder: maxOrder + 10, createdAt: now, updatedAt: now };
    if (draft.currency !== "multi") delete result.openingBalanceUsd;
    setState((s) => ({
      ...s,
      accounts: s.accounts.some((a) => a.id === result.id)
        ? s.accounts.map((a) => (a.id === result.id ? result : a))
        : [...s.accounts, result],
    }));
    return result;
  }, []);

  const archiveAccount = useCallback((id: string, archived: boolean) => {
    const now = nowISO();
    setState((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, isActive: !archived, updatedAt: now } : a)),
    }));
  }, []);

  const deleteAccount = useCallback((id: string): DeleteResult => {
    const count = accountUsage(id);
    if (count > 0) return { ok: false, reason: "in-use", count };
    const now = nowISO();
    setState((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, deletedAt: now, updatedAt: now, isActive: false } : a)),
    }));
    return { ok: true };
  }, [accountUsage]);

  /* ---------- Kateqoriya CRUD ---------- */
  const categoryUsage = useCallback(
    (id: string) => stateRef.current.transactions.filter((t) => !t.deletedAt && t.categoryId === id).length,
    [],
  );

  const saveCategory = useCallback((id: string | null, draft: CategoryDraft): Category => {
    const now = nowISO();
    const cur = stateRef.current;
    const existing = id ? cur.categories.find((c) => c.id === id) : undefined;
    const maxOrder = cur.categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const result: Category = existing
      ? { ...existing, ...draft, updatedAt: now }
      : { id: newId(), ...draft, sortOrder: maxOrder + 10, createdAt: now, updatedAt: now };
    setState((s) => ({
      ...s,
      categories: s.categories.some((c) => c.id === result.id)
        ? s.categories.map((c) => (c.id === result.id ? result : c))
        : [...s.categories, result],
    }));
    return result;
  }, []);

  const archiveCategory = useCallback((id: string, archived: boolean) => {
    const now = nowISO();
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === id ? { ...c, isActive: !archived, updatedAt: now } : c)),
    }));
  }, []);

  const deleteCategory = useCallback((id: string): DeleteResult => {
    const count = categoryUsage(id);
    if (count > 0) return { ok: false, reason: "in-use", count };
    const now = nowISO();
    setState((s) => ({
      ...s,
      categories: s.categories.map((c) => (c.id === id ? { ...c, deletedAt: now, updatedAt: now, isActive: false } : c)),
    }));
    return { ok: true };
  }, [categoryUsage]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  /* ---------- Sinxron ---------- */
  const syncNow = useCallback(async (): Promise<boolean> => {
    if (syncing.current) return false;
    syncing.current = true;
    const startedAt = nowISO();
    setState((s) => ({ ...s, sync: { ...s.sync, state: "syncing", lastError: undefined } }));
    try {
      const cur = stateRef.current;
      const res = await pushSync(
        { transactions: cur.transactions, accounts: cur.accounts, categories: cur.categories },
        cur.settings.syncToken,
      );
      // Sinxron zamanı edilmiş yerli dəyişikliklər (daha yeni updatedAt) itməsin deyə yenidən birləşdiririk
      setState((s) => ({
        ...s,
        transactions: mergeById(s.transactions, res.transactions).merged,
        accounts: mergeById(s.accounts, res.accounts).merged,
        categories: mergeById(s.categories, res.categories).merged,
        sync: { state: "success", lastSyncAt: startedAt },
      }));
      await repoRef.current?.saveSyncMeta({ lastSyncAt: startedAt });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sinxron zamanı xəta baş verdi.";
      blockedUntil.current = Date.now() + 60_000;
      setTimeout(() => setRetryTick((n) => n + 1), 60_000);
      setState((s) => ({ ...s, sync: { ...s.sync, state: "error", lastError: message } }));
      return false;
    } finally {
      syncing.current = false;
    }
  }, []);

  const pendingChanges = useMemo(() => {
    const since = state.sync.lastSyncAt ?? SEED_TIME;
    const count = (items: { updatedAt: string }[]) => items.filter((i) => i.updatedAt > since).length;
    return count(state.transactions) + count(state.accounts) + count(state.categories);
  }, [state.transactions, state.accounts, state.categories, state.sync.lastSyncAt]);

  // Avtomatik sinxron: dəyişiklikdən 4 san sonra (debounce), yalnız onlayn və avto-rejim açıqdırsa
  useEffect(() => {
    if (!state.ready || !state.settings.autoSync || pendingChanges === 0 || !online) return;
    if (state.sync.state === "syncing") return;
    const wait = Math.max(4000, blockedUntil.current - Date.now());
    const t = setTimeout(() => void syncNow(), wait);
    return () => clearTimeout(t);
  }, [state.ready, state.settings.autoSync, pendingChanges, online, syncNow, retryTick, state.sync.state]);

  /* ---------- Reload / backup ---------- */
  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const exportBackup = useCallback(() => {
    const s = stateRef.current;
    return JSON.stringify(
      { version: 1, exportedAt: nowISO(), transactions: s.transactions, accounts: s.accounts, categories: s.categories },
      null,
      2,
    );
  }, []);

  const importBackup = useCallback((json: string) => {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return { ok: false as const, error: "Fayl düzgün JSON deyil." };
    }
    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return { ok: false as const, error: `Ehtiyat nüsxə formatı yanlışdır${i ? ` (${i.path.join(".")}: ${i.message})` : ""}.` };
    }
    const before = stateRef.current.transactions.length;
    setState((s) => ({
      ...s,
      transactions: mergeById(s.transactions, parsed.data.transactions as Transaction[]).merged,
      accounts: mergeById(s.accounts, parsed.data.accounts as Account[]).merged,
      categories: mergeById(s.categories, parsed.data.categories as Category[]).merged,
    }));
    return { ok: true as const, added: Math.max(0, parsed.data.transactions.length - before) };
  }, []);

  /* ---------- Hesablanmış dəyərlər ---------- */
  const liveAccounts = useMemo(
    () => state.accounts.filter((a) => !a.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    [state.accounts],
  );
  const liveCategories = useMemo(
    () => state.categories.filter((c) => !c.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    [state.categories],
  );
  const liveTransactions = useMemo(
    () => sortTransactions(state.transactions.filter((t) => !t.deletedAt)),
    [state.transactions],
  );
  // Balans silinmiş hesabları da nəzərə alır ki, naməlum hesaba istinadlar pulu "yox etməsin"
  const balances = useMemo(
    () => computeBalances(state.accounts, state.transactions),
    [state.accounts, state.transactions],
  );
  const totals = useMemo(
    () => computeTotals(liveAccounts, balances, state.settings.usdRate),
    [liveAccounts, balances, state.settings.usdRate],
  );

  const api = useMemo<StoreApi>(
    () => ({
      ready: state.ready,
      persistent: state.persistent,
      accounts: liveAccounts,
      categories: liveCategories,
      transactions: liveTransactions,
      settings: state.settings,
      balances,
      totals,
      sync: state.sync,
      pendingChanges,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      saveAccount,
      archiveAccount,
      deleteAccount,
      accountUsage,
      saveCategory,
      archiveCategory,
      deleteCategory,
      categoryUsage,
      updateSettings,
      syncNow,
      reload,
      exportBackup,
      importBackup,
    }),
    [
      state.ready, state.persistent, state.settings, state.sync, liveAccounts, liveCategories, liveTransactions,
      balances, totals, pendingChanges, addTransaction, updateTransaction, deleteTransaction, saveAccount,
      archiveAccount, deleteAccount, accountUsage, saveCategory, archiveCategory, deleteCategory, categoryUsage,
      updateSettings, syncNow, reload, exportBackup, importBackup,
    ],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore StoreProvider daxilində istifadə olunmalıdır");
  return ctx;
}

export type { Snapshot };
