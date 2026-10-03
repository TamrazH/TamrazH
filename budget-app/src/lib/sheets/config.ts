export interface SheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

export type ConfigResult =
  | { ok: true; config: SheetsConfig }
  | { ok: false; missing: string[] };

type Env = Record<string, string | undefined>;

function normalizePrivateKey(key: string): string {
  // Vercel/.env-də \n hərfi şəklində gələ bilər; dırnaqlar da qalmış ola bilər
  return key.trim().replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

function parseServiceAccountJson(raw: string): { client_email?: string; private_key?: string } | null {
  const text = raw.trim();
  const candidates = [text];
  try {
    candidates.push(Buffer.from(text, "base64").toString("utf8"));
  } catch {
    /* base64 deyil */
  }
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c);
      if (obj && typeof obj === "object") return obj;
    } catch {
      /* növbəti namizəd */
    }
  }
  return null;
}

/** Konfiqurasiyanı yalnız environment-dən oxuyur. Qaytarılan "missing" yalnız dəyişən adlarını ehtiva edir. */
export function readSheetsConfig(env: Env = process.env): ConfigResult {
  const missing: string[] = [];
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");

  let clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = env.GOOGLE_PRIVATE_KEY ? normalizePrivateKey(env.GOOGLE_PRIVATE_KEY) : undefined;

  if (env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    const parsed = parseServiceAccountJson(env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (parsed?.client_email && parsed.private_key) {
      clientEmail = parsed.client_email;
      privateKey = normalizePrivateKey(parsed.private_key);
    }
  }
  if (!clientEmail || !privateKey) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_JSON (və ya GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)");
  }
  if (missing.length || !spreadsheetId || !clientEmail || !privateKey) return { ok: false, missing };
  return { ok: true, config: { spreadsheetId, clientEmail, privateKey } };
}
