import { SheetsError, errorFromStatus } from "./errors";

type FetchFn = typeof fetch;

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exponential backoff + jitter: base * 2^attempt, Retry-After başlığına hörmət edir. */
export function backoffDelay(
  attempt: number,
  opts: Required<Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "random">>,
  retryAfterHeader?: string | null,
): number {
  const ra = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(ra) && ra >= 0) return Math.min(ra * 1000, opts.maxDelayMs);
  const exp = opts.baseDelayMs * 2 ** attempt;
  return Math.min(exp + opts.random() * opts.baseDelayMs, opts.maxDelayMs);
}

/**
 * Sheets API sorğusu: 429/5xx və şəbəkə xətalarında exponential backoff ilə təkrar cəhd.
 * Uğursuzluq halında SheetsError atır.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetchFn: FetchFn = fetch,
  opts: RetryOptions = {},
): Promise<Response> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 8000;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;

  let lastError: SheetsError | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchFn(url, init);
      if (res.ok) return res;
      lastError = errorFromStatus(res.status);
      if (!RETRYABLE.has(res.status)) throw lastError;
      if (attempt < maxAttempts - 1) {
        await sleep(backoffDelay(attempt, { baseDelayMs, maxDelayMs, random }, res.headers.get("retry-after")));
      }
    } catch (e) {
      if (e instanceof SheetsError) {
        if (!RETRYABLE.has(e.status ?? 0)) throw e;
        continue;
      }
      lastError = new SheetsError("NETWORK", "Google Sheets-ə qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın.");
      if (attempt < maxAttempts - 1) await sleep(backoffDelay(attempt, { baseDelayMs, maxDelayMs, random }));
    }
  }
  throw lastError ?? new SheetsError("UNKNOWN", "Naməlum Google Sheets xətası.");
}
