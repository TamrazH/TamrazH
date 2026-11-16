import type { Account, Category, Transaction } from "@/types";
import { mergeById } from "../merge";
import type { SheetsConfig } from "./config";
import { getAccessToken } from "./auth";
import { SheetsError } from "./errors";
import { fetchWithRetry, type RetryOptions } from "./http";
import {
  ACCOUNT_HEADERS,
  CATEGORY_HEADERS,
  SHEET_NAMES,
  TRANSACTION_HEADERS,
  accountToRow,
  categoryToRow,
  parseAccounts,
  parseCategories,
  parseTransactions,
  transactionToRow,
  type Row,
} from "./mapping";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

export interface SheetsDeps {
  fetchFn?: typeof fetch;
  retry?: RetryOptions;
  now?: () => number;
}

export interface SyncInput {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
}

export interface SyncResult extends SyncInput {
  stats: {
    pushed: { transactions: number; accounts: number; categories: number };
    pulled: { transactions: number; accounts: number; categories: number };
    requests: number;
  };
}

interface SheetProps {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

class SheetsClient {
  requests = 0;
  constructor(
    private readonly config: SheetsConfig,
    private readonly deps: SheetsDeps,
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const fetchFn = this.deps.fetchFn ?? fetch;
    const token = await getAccessToken(this.config, fetchFn, this.deps.now);
    this.requests++;
    const res = await fetchWithRetry(
      `${API}/${encodeURIComponent(this.config.spreadsheetId)}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      },
      fetchFn,
      this.deps.retry,
    );
    return res.json();
  }

  async getSheets(): Promise<SheetProps[]> {
    const data = (await this.call(
      "?fields=sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))",
    )) as {
      sheets?: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[];
    };
    return (data.sheets ?? []).map((s) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      rowCount: s.properties.gridProperties?.rowCount ?? 1000,
      columnCount: s.properties.gridProperties?.columnCount ?? 26,
    }));
  }

  async getTitle(): Promise<string> {
    const data = (await this.call("?fields=properties.title")) as { properties?: { title?: string } };
    return data.properties?.title ?? "";
  }

  batchUpdateStructure(requests: unknown[]) {
    return this.call(":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  }

  async batchGet(ranges: string[]): Promise<Row[][]> {
    const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
    const data = (await this.call(
      `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
    )) as { valueRanges?: { values?: Row[] }[] };
    return ranges.map((_, i) => data.valueRanges?.[i]?.values ?? []);
  }

  batchWrite(data: { range: string; values: Row[] }[]) {
    return this.call("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
  }

  batchClear(ranges: string[]) {
    return this.call("/values:batchClear", { method: "POST", body: JSON.stringify({ ranges }) });
  }
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const SHEET_SPECS = [
  { title: SHEET_NAMES.transactions, headers: TRANSACTION_HEADERS },
  { title: SHEET_NAMES.accounts, headers: ACCOUNT_HEADERS },
  { title: SHEET_NAMES.categories, headers: CATEGORY_HEADERS },
] as const;

/** Bağlantı testi: yalnız cədvəlin mövcudluğunu və icazəni yoxlayır. */
export async function checkConnection(config: SheetsConfig, deps: SheetsDeps = {}) {
  return { title: await new SheetsClient(config, deps).getTitle() };
}

/**
 * Tam sinxron (4-6 sorğu, sətir başına sorğu YOXDUR):
 *  1) spreadsheets.get           — sheet-lərin mövcudluğu/ölçüsü
 *  2) (lazım olsa) batchUpdate    — çatışmayan sheet-ləri yarat / şəbəkəni genişləndir
 *  3) values.batchGet            — 3 sheet-i birdən oxu
 *  4) merge (updatedAt üzrə son dəyişiklik qalib)
 *  5) values.batchUpdate         — 3 sheet-i birdən yaz
 *  6) values.batchClear          — artıq qalan köhnə sətirləri təmizlə
 */
export async function syncWithSheets(
  config: SheetsConfig,
  input: SyncInput,
  deps: SheetsDeps = {},
): Promise<SyncResult> {
  const client = new SheetsClient(config, deps);

  // 1-2) Struktur
  let sheets = await client.getSheets();
  const missing = SHEET_SPECS.filter((s) => !sheets.some((x) => x.title === s.title));
  if (missing.length) {
    await client.batchUpdateStructure(
      missing.map((s) => ({
        addSheet: {
          properties: {
            title: s.title,
            gridProperties: { rowCount: 2000, columnCount: s.headers.length, frozenRowCount: 1 },
          },
        },
      })),
    );
    sheets = await client.getSheets();
  }

  // 3) Oxu
  const ranges = SHEET_SPECS.map((s) => `${s.title}!A:Z`);
  const [txValues, accValues, catValues] = (await client.batchGet(ranges)) as [Row[], Row[], Row[]];
  const remoteTx = parseTransactions(txValues);
  const remoteAcc = parseAccounts(accValues);
  const remoteCat = parseCategories(catValues);

  // Yanlış sətirləri səssizcə üstündən yazmaq data itkisi olardı — sinxronu dayandırıb göstəririk
  const invalid = [
    ["Transactions", remoteTx.invalidRows],
    ["Accounts", remoteAcc.invalidRows],
    ["Categories", remoteCat.invalidRows],
  ] as const;
  const bad = invalid.filter(([, rows]) => rows.length > 0);
  if (bad.length) {
    const detail = bad.map(([name, rows]) => `${name}: sətir ${rows.slice(0, 5).join(", ")}${rows.length > 5 ? "…" : ""}`).join("; ");
    throw new SheetsError(
      "BAD_REQUEST",
      `Google Sheets-də oxuna bilməyən sətirlər var (${detail}). Məlumat itkisinin qarşısını almaq üçün sinxron dayandırıldı — həmin sətirləri düzəldin və ya silin.`,
    );
  }

  // 4) Birləşdir
  const tx = mergeById(input.transactions, remoteTx.items);
  const acc = mergeById(input.accounts, remoteAcc.items);
  const cat = mergeById(input.categories, remoteCat.items);

  const accName = new Map(acc.merged.map((a) => [a.id, a.name]));
  const catName = new Map(cat.merged.map((c) => [c.id, c.name]));
  const sortedTx = [...tx.merged].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );
  const sortedAcc = [...acc.merged].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedCat = [...cat.merged].sort((a, b) => a.sortOrder - b.sortOrder);

  const tables: Record<string, Row[]> = {
    [SHEET_NAMES.transactions]: [
      [...TRANSACTION_HEADERS],
      ...sortedTx.map((t) =>
        transactionToRow(t, {
          account: (id) => accName.get(id) ?? "",
          category: (id) => catName.get(id) ?? "",
        }),
      ),
    ],
    [SHEET_NAMES.accounts]: [[...ACCOUNT_HEADERS], ...sortedAcc.map(accountToRow)],
    [SHEET_NAMES.categories]: [[...CATEGORY_HEADERS], ...sortedCat.map(categoryToRow)],
  };

  // Lazım gələrsə şəbəkəni genişləndir (values.update grid limitindən kənara yaza bilmir)
  const grow = SHEET_SPECS.flatMap((spec) => {
    const props = sheets.find((s) => s.title === spec.title);
    const needRows = (tables[spec.title] as Row[]).length + 100;
    if (props && props.rowCount < needRows) {
      return [
        {
          updateSheetProperties: {
            properties: { sheetId: props.sheetId, gridProperties: { rowCount: needRows } },
            fields: "gridProperties.rowCount",
          },
        },
      ];
    }
    return [];
  });
  if (grow.length) await client.batchUpdateStructure(grow);

  // 5) Yaz — yalnız dəyişiklik varsa və ya sheet boşdursa
  const needsWrite =
    tx.localWins + acc.localWins + cat.localWins > 0 ||
    txValues.length === 0 || accValues.length === 0 || catValues.length === 0;

  if (needsWrite) {
    await client.batchWrite(
      SHEET_SPECS.map((s) => ({ range: `${s.title}!A1`, values: tables[s.title] as Row[] })),
    );
    // 6) Köhnə artıq sətirləri təmizlə
    const clears = SHEET_SPECS.flatMap((s) => {
      const written = (tables[s.title] as Row[]).length;
      const oldLen = { [SHEET_NAMES.transactions]: txValues.length, [SHEET_NAMES.accounts]: accValues.length, [SHEET_NAMES.categories]: catValues.length }[s.title] ?? 0;
      return oldLen > written ? [`${s.title}!A${written + 1}:${colLetter(s.headers.length)}`] : [];
    });
    if (clears.length) await client.batchClear(clears);
  }

  return {
    transactions: tx.merged,
    accounts: acc.merged,
    categories: cat.merged,
    stats: {
      pushed: { transactions: tx.localWins, accounts: acc.localWins, categories: cat.localWins },
      pulled: { transactions: tx.remoteWins, accounts: acc.remoteWins, categories: cat.remoteWins },
      requests: client.requests,
    },
  };
}

export { SheetsError };
