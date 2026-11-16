import { NextResponse } from "next/server";
import { verifySyncToken } from "@/lib/api-auth";
import { syncPayloadSchema } from "@/lib/schemas";
import { readSheetsConfig } from "@/lib/sheets/config";
import { SheetsError } from "@/lib/sheets/errors";
import { syncWithSheets } from "@/lib/sheets/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_000_000; // Vercel limiti 4.5MB

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

/** POST /api/sheets/sync — yerli məlumatı Google Sheets ilə birləşdirir (last-write-wins). */
export async function POST(req: Request) {
  if (!verifySyncToken(req.headers.get("x-sync-token"))) {
    return fail(401, "UNAUTHORIZED", "Sinxron parolu yanlışdır. Parametrlərdə parolu yoxlayın.");
  }

  const cfg = readSheetsConfig();
  if (!cfg.ok) {
    return fail(
      503,
      "NOT_CONFIGURED",
      `Google Sheets konfiqurasiya olunmayıb. Çatışmayan environment dəyişənləri: ${cfg.missing.join(", ")}`,
    );
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return fail(413, "TOO_LARGE", "Məlumat sinxron üçün çox böyükdür.");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "BAD_JSON", "Sorğunun məzmunu düzgün JSON deyil.");
  }

  // Server tərəfdə tam validation: məbləğ, valyuta, növ, tarix və s.
  const parsed = syncPayloadSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue ? issue.path.join(".") : "";
    return fail(422, "VALIDATION", `Yanlış məlumat${where ? ` (${where})` : ""}: ${issue?.message ?? "format xətası"}`);
  }

  try {
    const result = await syncWithSheets(cfg.config, parsed.data);
    return NextResponse.json({ ok: true, ...result, syncedAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof SheetsError) {
      const status = e.code === "RATE_LIMITED" ? 429 : e.code === "UNAVAILABLE" || e.code === "NETWORK" ? 503 : e.code === "BAD_REQUEST" ? 422 : 502;
      return fail(status, e.code, e.userMessage);
    }
    console.error("Sheets sync unexpected error", e instanceof Error ? e.message : "unknown");
    return fail(500, "UNKNOWN", "Sinxron zamanı gözlənilməz xəta baş verdi.");
  }
}
