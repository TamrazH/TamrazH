import type {
  Account,
  AccountCurrency,
  AccountType,
  Category,
  CategoryGroup,
  Settings,
} from "@/types";
import { slugify } from "./ids";

/**
 * Default entity-lərin createdAt/updatedAt dəyəri sabitdir. Beləliklə:
 *  - eyni ID-lər bütün cihazlarda eynidir (dublikat yaranmır),
 *  - istifadəçinin hər hansı real dəyişikliyi (updatedAt > SEED_TIME) həmişə qalib gəlir.
 */
export const SEED_TIME = "2024-01-01T00:00:00.000Z";

type AccountSeed = [name: string, type: AccountType, currency: AccountCurrency];

const ACCOUNT_SEEDS: AccountSeed[] = [
  ["Bank Payoneer", "bank", "multi"],
  ["Bank Wise", "bank", "multi"],
  ["Binance BTC", "crypto", "USD"],
  ["Binance USDT", "crypto", "USD"],
  ["Creditor iTest", "creditor", "multi"],
  ["Creditor Knyaz d", "creditor", "multi"],
  ["Debtor Alim", "debtor", "multi"],
  ["Debtor Bextiyar", "debtor", "multi"],
  ["Debtor BMS Elvin", "debtor", "multi"],
  ["Debtor BMS Parviz", "debtor", "multi"],
  ["Debtor Ceyhun", "debtor", "multi"],
  ["Debtor Kamran", "debtor", "multi"],
  ["Debtor Knyaz d", "debtor", "multi"],
  ["Depozit ABB", "deposit", "AZN"],
  ["Depozit ABB Reyhan AZN", "deposit", "AZN"],
  ["Depozit ABB Reyhan USD", "deposit", "USD"],
  ["Depozit Access", "deposit", "AZN"],
  ["İnvest ABB Lokal", "investment", "AZN"],
  ["İnvest ABB USA", "investment", "USD"],
  ["Kart ABB", "card", "multi"],
  ["Kart Access", "card", "multi"],
  ["Kart ATB", "card", "multi"],
  ["Kart Bank Respublika", "card", "multi"],
  ["Kart Pasha T", "card", "multi"],
  ["Kart Reyhan ABB", "card", "multi"],
  ["Kart Reyhan ATB", "card", "multi"],
  ["Kart Reyhan Kapital", "card", "multi"],
  ["Kart Unibank", "card", "multi"],
  ["Nağd AZN", "cash", "AZN"],
  ["Nağd USD", "cash", "USD"],
];

export function defaultAccounts(): Account[] {
  return ACCOUNT_SEEDS.map(([name, type, currency], i) => ({
    id: `acc-${slugify(name)}`,
    name,
    type,
    currency,
    openingBalance: 0,
    isActive: true,
    sortOrder: (i + 1) * 10,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));
}

type CategorySeed = [name: string, group: CategoryGroup, icon: string];

const CATEGORY_SEEDS: CategorySeed[] = [
  ["Balans", "balance", "⚖️"],
  ["Gəlir: Depozit Faizi", "income", "🏦"],
  ["Gəlir: Digər", "income", "💵"],
  ["Gəlir: Frilans iTest", "income", "💻"],
  ["Gəlir: Maaş Reyhan", "income", "💼"],
  ["Gəlir: Maaş Tamraz", "income", "💼"],
  ["Transfer", "transfer", "🔁"],
  ["Transfer: Avans Alma", "transfer", "📥"],
  ["Transfer: Avans Qaytarma", "transfer", "📤"],
  ["Transfer: Borc Qaytarma", "transfer", "↩️"],
  ["Transfer: Borc Vermə", "transfer", "🤝"],
  ["Xərc: Abunəliklər", "expense", "📱"],
  ["Xərc: Biznes", "expense", "🏢"],
  ["Xərc: Ərzaq", "expense", "🥦"],
  ["Xərc: Əyləncə", "expense", "🎬"],
  ["Xərc: Geyim", "expense", "👕"],
  ["Xərc: Komissiya", "expense", "🧾"],
  ["Xərc: Kommunal", "expense", "💡"],
  ["Xərc: Market (Qida)", "expense", "🛒"],
  ["Xərc: Məişət (Ev)", "expense", "🏠"],
  ["Xərc: Nəqliyyat", "expense", "🚌"],
  ["Xərc: Restoran", "expense", "🍽️"],
  ["Xərc: Sağlamlıq", "expense", "💊"],
  ["Xərc: Şəxsi", "expense", "🧴"],
  ["Xərc: Sosial", "expense", "🎁"],
  ["Xərc: Təhsil", "expense", "🎓"],
  ["İnvestisiya", "investment", "📈"],
  ["İnvestisiya: Kripto Alışı", "investment", "₿"],
  ["İnvestisiya: Kripto Satışı", "investment", "💱"],
  ["İnvestisiya: Depozit Yerləşdirmə", "investment", "🏦"],
  ["İnvestisiya: Depozit Çıxarılması", "investment", "🏧"],
  ["İnvestisiya: Digər", "investment", "📊"],
];

export const GROUP_COLORS: Record<CategoryGroup, string> = {
  income: "#16a34a",
  expense: "#e11d48",
  transfer: "#2f6fed",
  investment: "#9333ea",
  balance: "#64748b",
};

export function defaultCategories(): Category[] {
  return CATEGORY_SEEDS.map(([name, group, icon], i) => ({
    id: `cat-${slugify(name)}`,
    name,
    group,
    isActive: true,
    sortOrder: (i + 1) * 10,
    icon,
    color: GROUP_COLORS[group],
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));
}

export const DEFAULT_USD_RATE = 1.7;

export function defaultSettings(): Settings {
  return {
    theme: "system",
    usdRate: DEFAULT_USD_RATE,
    autoSync: false,
    syncToken: "",
    lastUsed: {},
  };
}
