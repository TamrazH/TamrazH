import { NextResponse } from "next/server";
import { isSyncTokenRequired, verifySyncToken } from "@/lib/api-auth";
import { readSheetsConfig } from "@/lib/sheets/config";
import { checkConnection } from "@/lib/sheets/sync";
import { SheetsError } from "@/lib/sheets/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sheets/status        -> konfiqurasiya vəziyyəti (secret DEYİL, yalnız dəyişən adları)
 * GET /api/sheets/status?check=1 -> həmçinin Google-a real bağlantı testi
 */
export async function GET(req: Request) {
  const cfg = readSheetsConfig();
  const tokenRequired = isSyncTokenRequired();
  const base = {
    configured: cfg.ok,
    missing: cfg.ok ? [] : cfg.missing,
    tokenRequired,
  };

  const url = new URL(req.url);
  if (url.searchParams.get("check") !== "1" || !cfg.ok) return NextResponse.json(base);

  if (!verifySyncToken(req.headers.get("x-sync-token"))) {
    return NextResponse.json({ ...base, error: "Sinxron parolu yanlışdır." }, { status: 401 });
  }
  try {
    const { title } = await checkConnection(cfg.config);
    return NextResponse.json({ ...base, connected: true, title });
  } catch (e) {
    const err = e instanceof SheetsError ? e : new SheetsError("UNKNOWN", "Bağlantı yoxlanılarkən xəta baş verdi.");
    return NextResponse.json({ ...base, connected: false, error: err.userMessage, code: err.code }, { status: 200 });
  }
}
