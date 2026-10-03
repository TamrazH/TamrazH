import type { Account, Category, Settings, Snapshot, Transaction } from "@/types";
import { defaultAccounts, defaultCategories, defaultSettings } from "@/lib/defaults";

/**
 * Saxlama qatı. UI yalnız bu interfeysdən asılıdır; sonradan Vercel Postgres/Supabase
 * üçün eyni interfeysi həyata keçirən yeni sinif yazmaq kifayətdir.
 */
export interface Repository {
  /** Mövcud məlumat yoxdursa default hesab/kateqoriyalarla başlayır */
  load(): Promise<{ snapshot: Snapshot; settings: Settings; seeded: boolean }>;
  saveTransactions(items: Transaction[]): Promise<void>;
  saveAccounts(items: Account[]): Promise<void>;
  saveCategories(items: Category[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  loadSyncMeta(): Promise<{ lastSyncAt?: string }>;
  saveSyncMeta(meta: { lastSyncAt?: string }): Promise<void>;
}

const KEYS = {
  transactions: "budget:v1:transactions",
  accounts: "budget:v1:accounts",
  categories: "budget:v1:categories",
  settings: "budget:v1:settings",
  syncMeta: "budget:v1:syncMeta",
} as const;

export class StorageQuotaError extends Error {
  constructor() {
    super("Cihazın yaddaşı doludur. Köhnə məlumatları silin və ya Google Sheets-ə sinxron edin.");
    this.name = "StorageQuotaError";
  }
}

function readJSON<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Zədələnmiş məlumat: üstündən yazmamaq üçün ehtiyat nüsxə saxlayırıq
    try {
      storage.setItem(`${key}:corrupt:${Date.now()}`, raw);
    } catch {
      /* yer yoxdur — keçirik */
    }
    return null;
  }
}

function writeJSON(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      throw new StorageQuotaError();
    }
    throw e;
  }
}

export class LocalStorageRepository implements Repository {
  constructor(private readonly storage: Storage) {}

  async load() {
    const s = this.storage;
    const tx = readJSON<Transaction[]>(s, KEYS.transactions);
    const acc = readJSON<Account[]>(s, KEYS.accounts);
    const cat = readJSON<Category[]>(s, KEYS.categories);
    const settings = readJSON<Partial<Settings>>(s, KEYS.settings);
    const seeded = acc === null || cat === null;
    const snapshot: Snapshot = {
      transactions: Array.isArray(tx) ? tx : [],
      accounts: Array.isArray(acc) ? acc : defaultAccounts(),
      categories: Array.isArray(cat) ? cat : defaultCategories(),
    };
    return { snapshot, settings: { ...defaultSettings(), ...(settings ?? {}) }, seeded };
  }

  async saveTransactions(items: Transaction[]) {
    writeJSON(this.storage, KEYS.transactions, items);
  }
  async saveAccounts(items: Account[]) {
    writeJSON(this.storage, KEYS.accounts, items);
  }
  async saveCategories(items: Category[]) {
    writeJSON(this.storage, KEYS.categories, items);
  }
  async saveSettings(settings: Settings) {
    writeJSON(this.storage, KEYS.settings, settings);
  }
  async loadSyncMeta() {
    return readJSON<{ lastSyncAt?: string }>(this.storage, KEYS.syncMeta) ?? {};
  }
  async saveSyncMeta(meta: { lastSyncAt?: string }) {
    writeJSON(this.storage, KEYS.syncMeta, meta);
  }
}

export const STORAGE_KEYS = KEYS;
