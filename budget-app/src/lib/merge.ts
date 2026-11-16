/**
 * Sinxron üçün birləşdirmə: id üzrə, updatedAt-ı daha yeni olan qalib gəlir ("son dəyişiklik qalib").
 * updatedAt bərabər olarsa, qeydlər eyni sayılır (uzaq tərəf saxlanılır).
 * Silinmiş qeydlər (deletedAt) tombstone kimi saxlanılır ki, silmə də sinxron olunsun.
 */
export interface Mergeable {
  id: string;
  updatedAt: string;
}

export interface MergeResult<T> {
  merged: T[];
  /** Yerli tərəfin qalib gəldiyi (uzaq tərəfdən yeni və ya uzaqda olmayan) qeydlər sayı */
  localWins: number;
  /** Uzaq tərəfin qalib gəldiyi (yerlidən yeni və ya yerlidə olmayan) qeydlər sayı */
  remoteWins: number;
}

function ts(s: string): number {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export function mergeById<T extends Mergeable>(local: T[], remote: T[]): MergeResult<T> {
  const winners = new Map<string, { item: T; from: "local" | "remote" }>();

  const consider = (item: T, from: "local" | "remote") => {
    const cur = winners.get(item.id);
    if (!cur || ts(item.updatedAt) > ts(cur.item.updatedAt)) {
      winners.set(item.id, { item, from });
    }
  };
  // Əvvəl uzaq, sonra yerli: bərabərlikdə uzaq qalır
  for (const r of remote) consider(r, "remote");
  for (const l of local) consider(l, "local");

  let localWins = 0;
  let remoteWins = 0;
  for (const w of winners.values()) {
    if (w.from === "local") localWins++;
    else remoteWins++;
  }
  return { merged: [...winners.values()].map((w) => w.item), localWins, remoteWins };
}
