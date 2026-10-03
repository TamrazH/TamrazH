import type { Snapshot } from "@/types";

export interface SyncStatusResponse {
  configured: boolean;
  missing: string[];
  tokenRequired: boolean;
  connected?: boolean;
  title?: string;
  error?: string;
}

export interface SyncResponse extends Snapshot {
  ok: true;
  syncedAt: string;
  stats: {
    pushed: { transactions: number; accounts: number; categories: number };
    pulled: { transactions: number; accounts: number; categories: number };
    requests: number;
  };
}

export class SyncError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "SyncError";
  }
}

function headers(token: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["x-sync-token"] = token;
  return h;
}

export async function fetchSyncStatus(token: string, check = false): Promise<SyncStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`/api/sheets/status${check ? "?check=1" : ""}`, { headers: headers(token), cache: "no-store" });
  } catch {
    throw new SyncError("Serverə qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın.", "NETWORK");
  }
  const data = (await res.json().catch(() => null)) as SyncStatusResponse | null;
  if (!data) throw new SyncError("Server cavabı oxunmadı.", "BAD_RESPONSE");
  return data;
}

export async function pushSync(snapshot: Snapshot, token: string): Promise<SyncResponse> {
  let res: Response;
  try {
    res = await fetch("/api/sheets/sync", {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(snapshot),
    });
  } catch {
    throw new SyncError("Serverə qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın.", "NETWORK");
  }
  const data = (await res.json().catch(() => null)) as
    | (SyncResponse & { ok: true })
    | { ok: false; code: string; error: string }
    | null;
  if (!data) throw new SyncError(`Server cavabı oxunmadı (${res.status}).`, "BAD_RESPONSE");
  if (!data.ok) throw new SyncError(data.error, data.code);
  return data;
}
