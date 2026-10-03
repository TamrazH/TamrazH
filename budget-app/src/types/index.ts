export type Currency = "AZN" | "USD";
export type AccountCurrency = Currency | "multi";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "investment"
  | "balance";

export type CategoryGroup = TransactionType;

export type AccountType =
  | "bank"
  | "card"
  | "cash"
  | "crypto"
  | "deposit"
  | "investment"
  | "debtor"
  | "creditor"
  | "other";

/** Balans düzəlişi (type="balance") üçün istiqamət. */
export type Direction = "in" | "out";

export interface Transaction {
  id: string;
  /** Yerli tarix, YYYY-MM-DD */
  date: string;
  /** Əməliyyatın aid olduğu hesab (transfer/investisiyada — mənbə hesab) */
  accountId: string;
  categoryId: string;
  description: string;
  /** Həmişə müsbət; işarə type-dan müəyyənləşir */
  amount: number;
  currency: Currency;
  type: TransactionType;
  /** Yalnız transfer və investisiya: hədəf hesab */
  toAccountId?: string;
  /** Hədəf hesabın valyutası fərqlidirsə, hədəfə düşən məbləğ */
  toAmount?: number;
  /** Yalnız type="balance": düzəlişin istiqaməti (default "in") */
  direction?: Direction;
  notes?: string;
  attachmentUrl?: string;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete (sinxron üçün tombstone) */
  deletedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: AccountCurrency;
  /** Hesabın valyutasında başlanğıc qalıq (multi üçün — AZN hissəsi) */
  openingBalance: number;
  /** Yalnız multi hesab: USD başlanğıc qalığı */
  openingBalanceUsd?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  isActive: boolean;
  sortOrder: number;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type ThemeMode = "system" | "light" | "dark";

export interface LastUsed {
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  currency?: Currency;
}

export interface Settings {
  theme: ThemeMode;
  /** 1 USD = ? AZN */
  usdRate: number;
  autoSync: boolean;
  /** APP_SYNC_TOKEN ilə eyni parol (server tərəfdə təyin olunubsa) */
  syncToken: string;
  /** Əməliyyat növünə görə son istifadə olunan seçimlər */
  lastUsed: Partial<Record<TransactionType, LastUsed>>;
}

export type SyncState = "idle" | "syncing" | "success" | "error";

export interface SyncMeta {
  state: SyncState;
  /** Son uğurlu sinxronun başlama vaxtı (ISO) */
  lastSyncAt?: string;
  lastError?: string;
}

export interface Snapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export interface Balance {
  AZN: number;
  USD: number;
}
