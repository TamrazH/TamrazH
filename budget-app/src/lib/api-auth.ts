import { timingSafeEqual } from "node:crypto";

/**
 * Login yoxdur, lakin sinxron endpoint-lərini qorumaq üçün istəyə bağlı parol:
 * APP_SYNC_TOKEN təyin olunubsa, sorğu "x-sync-token" başlığında eyni dəyəri göndərməlidir.
 */
export function isSyncTokenRequired(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.APP_SYNC_TOKEN?.trim());
}

export function verifySyncToken(
  provided: string | null,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const expected = env.APP_SYNC_TOKEN?.trim();
  if (!expected) return true;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
