/** localStorage əlçatmaz olduqda (məs. Safari private rejimi) istifadə olunan müvəqqəti yaddaş. */
export class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  [name: string]: unknown;
}

export function pickStorage(): { storage: Storage; persistent: boolean } {
  try {
    const s = window.localStorage;
    const probe = "__budget_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return { storage: s, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}
