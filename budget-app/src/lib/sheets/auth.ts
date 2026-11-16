import { createSign } from "node:crypto";
import { SheetsError } from "./errors";
import type { SheetsConfig } from "./config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

type FetchFn = typeof fetch;

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function buildJwt(config: SheetsConfig, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  let signature: Buffer;
  try {
    signature = signer.sign(config.privateKey);
  } catch {
    throw new SheetsError("AUTH_FAILED", "Service account private key oxunmadı. GOOGLE_PRIVATE_KEY/JSON formatını yoxlayın.");
  }
  return `${header}.${claim}.${b64url(signature)}`;
}

let cached: { key: string; token: string; expiresAt: number } | null = null;

export function clearTokenCache() {
  cached = null;
}

export async function getAccessToken(
  config: SheetsConfig,
  fetchFn: FetchFn = fetch,
  now: () => number = Date.now,
): Promise<string> {
  const cacheKey = config.clientEmail;
  if (cached && cached.key === cacheKey && cached.expiresAt - 60_000 > now()) return cached.token;

  const jwt = buildJwt(config, Math.floor(now() / 1000));
  let res: Response;
  try {
    res = await fetchFn(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
  } catch {
    throw new SheetsError("NETWORK", "Google-a qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın.");
  }
  if (!res.ok) {
    throw new SheetsError("AUTH_FAILED", "Google hesabına giriş alınmadı. Service account açarını yoxlayın.", res.status);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new SheetsError("AUTH_FAILED", "Google access token qaytarmadı.");
  cached = {
    key: cacheKey,
    token: data.access_token,
    expiresAt: now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}
