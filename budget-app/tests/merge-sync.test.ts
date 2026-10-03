import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mergeById } from "@/lib/merge";
import { readSheetsConfig } from "@/lib/sheets/config";
import { backoffDelay, fetchWithRetry } from "@/lib/sheets/http";
import { SheetsError } from "@/lib/sheets/errors";
import { syncWithSheets } from "@/lib/sheets/sync";
import { clearTokenCache } from "@/lib/sheets/auth";
import { acc, cat, tx } from "./helpers";
import type { Transaction } from "@/types";

const rec = (id: string, updatedAt: string, v = "") => ({ id, updatedAt, v });

describe("mergeById", () => {
  it("daha yeni updatedAt qalib gəlir", () => {
    const r = mergeById(
      [rec("a", "2026-02-01T00:00:00Z", "local"), rec("b", "2026-01-01T00:00:00Z", "local")],
      [rec("a", "2026-01-01T00:00:00Z", "remote"), rec("b", "2026-02-01T00:00:00Z", "remote"), rec("c", "2026-01-01T00:00:00Z", "remote")],
    );
    const m = Object.fromEntries(r.merged.map((x) => [x.id, x.v]));
    expect(m).toEqual({ a: "local", b: "remote", c: "remote" });
    expect(r.localWins).toBe(1);
    expect(r.remoteWins).toBe(2);
  });
  it("tombstone daha yenidirsə silinmə qalib gəlir", () => {
    const local = [{ ...rec("a", "2026-03-01T00:00:00Z"), deletedAt: "2026-03-01T00:00:00Z" }];
    const remote = [rec("a", "2026-02-01T00:00:00Z")];
    expect(mergeById(local, remote).merged[0]).toHaveProperty("deletedAt");
  });
});

describe("fetchWithRetry", () => {
  const res = (status: number, headers: Record<string, string> = {}) =>
    new Response(status < 300 ? "{}" : "err", { status, headers });
  const fast = { sleep: async () => {}, random: () => 0 };

  it("429/503-də təkrar edir və uğur qazanır", async () => {
    let calls = 0;
    const delays: number[] = [];
    const f = (async () => (++calls < 3 ? res(calls === 1 ? 429 : 503) : res(200))) as unknown as typeof fetch;
    const r = await fetchWithRetry("http://x", {}, f, { ...fast, sleep: async (ms) => void delays.push(ms), baseDelayMs: 100 });
    expect(r.ok).toBe(true);
    expect(calls).toBe(3);
    expect(delays).toEqual([100, 200]); // exponential
  });
  it("403-də təkrar etmir, user-friendly xəta atır", async () => {
    let calls = 0;
    const f = (async () => (calls++, res(403))) as unknown as typeof fetch;
    await expect(fetchWithRetry("http://x", {}, f, fast)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls).toBe(1);
  });
  it("limit bitəndə son xətanı atır", async () => {
    let calls = 0;
    const f = (async () => (calls++, res(500))) as unknown as typeof fetch;
    await expect(fetchWithRetry("http://x", {}, f, { ...fast, maxAttempts: 3 })).rejects.toBeInstanceOf(SheetsError);
    expect(calls).toBe(3);
  });
  it("şəbəkə xətasını təkrar edir", async () => {
    let calls = 0;
    const f = (async () => {
      if (++calls < 2) throw new TypeError("fetch failed");
      return res(200);
    }) as unknown as typeof fetch;
    expect((await fetchWithRetry("http://x", {}, f, fast)).ok).toBe(true);
  });
  it("Retry-After başlığına hörmət edir", () => {
    expect(backoffDelay(0, { baseDelayMs: 500, maxDelayMs: 8000, random: () => 0 }, "2")).toBe(2000);
    expect(backoffDelay(10, { baseDelayMs: 500, maxDelayMs: 8000, random: () => 0 })).toBe(8000);
  });
});

describe("readSheetsConfig", () => {
  it("çatışmayanları adla bildirir, dəyər sızdırmır", () => {
    const r = readSheetsConfig({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing.length).toBe(2);
  });
  it("ayrı dəyişənlər və \\n key", () => {
    const r = readSheetsConfig({
      GOOGLE_SHEETS_SPREADSHEET_ID: "sid",
      GOOGLE_SERVICE_ACCOUNT_EMAIL: "a@b.iam.gserviceaccount.com",
      GOOGLE_PRIVATE_KEY: "-----BEGIN-----\\nabc\\n-----END-----",
    });
    expect(r.ok && r.config.privateKey).toBe("-----BEGIN-----\nabc\n-----END-----");
  });
  it("JSON və base64 JSON", () => {
    const json = JSON.stringify({ client_email: "x@y", private_key: "k" });
    for (const v of [json, Buffer.from(json).toString("base64")]) {
      const r = readSheetsConfig({ GOOGLE_SHEETS_SPREADSHEET_ID: "sid", GOOGLE_SERVICE_ACCOUNT_JSON: v });
      expect(r.ok && r.config.clientEmail).toBe("x@y");
    }
  });
});

/** Sheets API-nin minimal in-memory saxta versiyası */
function fakeGoogle(opts: { failFirstWrite?: boolean } = {}) {
  const sheets = new Map<string, unknown[][]>();
  const log: string[] = [];
  let failedOnce = false;
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body && typeof init.body === "string" ? init.body : "";
    if (url.hostname === "oauth2.googleapis.com") return json({ access_token: "tok", expires_in: 3600 });
    const path = url.pathname.replace(/^\/v4\/spreadsheets\/[^/:]+/, "");
    log.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "" && url.searchParams.get("fields")?.startsWith("sheets"))
      return json({ sheets: [...sheets.keys()].map((t, i) => ({ properties: { sheetId: i, title: t, gridProperties: { rowCount: 1000, columnCount: 26 } } })) });
    if (path === ":batchUpdate") {
      for (const r of JSON.parse(body).requests) if (r.addSheet) sheets.set(r.addSheet.properties.title, []);
      return json({});
    }
    if (path === "/values:batchGet") {
      const ranges = url.searchParams.getAll("ranges");
      return json({ valueRanges: ranges.map((r) => ({ values: sheets.get(r.split("!")[0]!) ?? [] })) });
    }
    if (path === "/values:batchUpdate") {
      if (opts.failFirstWrite && !failedOnce) { failedOnce = true; return new Response("x", { status: 503 }); }
      for (const d of JSON.parse(body).data) sheets.set(d.range.split("!")[0], d.values);
      return json({});
    }
    if (path === "/values:batchClear") return json({});
    return json({}, 404);
  }) as unknown as typeof fetch;
  return { fn, sheets, log };
}

describe("syncWithSheets", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const config = { spreadsheetId: "sid", clientEmail: "svc@p.iam.gserviceaccount.com", privateKey };
  const retry = { sleep: async () => {}, random: () => 0 };

  const t1: Transaction = tx({ id: "t1", type: "expense", accountId: "a1", categoryId: "c1", amount: 12.5, description: "=HYPERLINK(\"x\")", updatedAt: "2026-03-01T10:00:00.000Z" });
  const input = { transactions: [t1], accounts: [acc({ id: "a1", name: "Nağd AZN" })], categories: [cat({ id: "c1", name: "Xərc: Ərzaq" })] };

  it("boş cədvəli yaradır, batch yazır (sətir başına sorğu yoxdur) və geri oxuyur", async () => {
    clearTokenCache();
    const g = fakeGoogle();
    const r = await syncWithSheets(config, input, { fetchFn: g.fn, retry });
    expect([...g.sheets.keys()].sort()).toEqual(["Accounts", "Categories", "Transactions"]);
    expect(g.sheets.get("Transactions")!.length).toBe(2); // header + 1
    expect(r.stats.requests).toBeLessThanOrEqual(6);
    // ikinci sinxron: heç nə dəyişməyib -> yazma yoxdur
    g.log.length = 0;
    const r2 = await syncWithSheets(config, input, { fetchFn: g.fn, retry });
    expect(g.log.some((l) => l.includes("batchUpdate") && l.includes("values"))).toBe(false);
    expect(r2.transactions[0]).toMatchObject({ id: "t1", amount: 12.5, description: t1.description });
  });

  it("konflikt: sheet-dəki daha yeni dəyişiklik qalib gəlir, yerli yeni isə yazılır", async () => {
    clearTokenCache();
    const g = fakeGoogle();
    await syncWithSheets(config, input, { fetchFn: g.fn, retry });
    // sheet-də t1-i "başqa cihaz" daha yeni dəyişib
    const rows = g.sheets.get("Transactions")!;
    const header = rows[0] as string[];
    rows[1]![header.indexOf("amount")] = 99;
    rows[1]![header.indexOf("updatedAt")] = "2026-04-01T00:00:00.000Z";
    const r = await syncWithSheets(config, input, { fetchFn: g.fn, retry });
    expect(r.transactions[0]!.amount).toBe(99);
    // indi yerli daha yeni olsun
    const newer = { ...input, transactions: [{ ...t1, amount: 5, updatedAt: "2026-05-01T00:00:00.000Z" }] };
    const r2 = await syncWithSheets(config, newer, { fetchFn: g.fn, retry });
    expect(r2.transactions[0]!.amount).toBe(5);
    expect(g.sheets.get("Transactions")![1]![header.indexOf("amount")]).toBe(5);
  });

  it("yazma 503 verəndə retry edir", async () => {
    clearTokenCache();
    const g = fakeGoogle({ failFirstWrite: true });
    await syncWithSheets(config, input, { fetchFn: g.fn, retry });
    expect(g.sheets.get("Transactions")!.length).toBe(2);
  });

  it("oxunmayan sətir olarsa data itkisi olmasın deyə dayanır", async () => {
    clearTokenCache();
    const g = fakeGoogle();
    await syncWithSheets(config, input, { fetchFn: g.fn, retry });
    g.sheets.get("Transactions")!.push(["bad-id", "not-a-date", "a1", "c1", "", "abc", "AZN", "expense"]);
    await expect(syncWithSheets(config, input, { fetchFn: g.fn, retry })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
