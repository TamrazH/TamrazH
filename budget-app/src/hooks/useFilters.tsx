"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { EMPTY_FILTERS, type TransactionFilters } from "@/lib/filters";

interface FiltersApi {
  filters: TransactionFilters;
  setFilters: (f: TransactionFilters) => void;
  patch: (p: Partial<TransactionFilters>) => void;
  reset: () => void;
}

const FiltersContext = createContext<FiltersApi | null>(null);

/** Filtrlər səhifələr arasında (məs. Hesablar -> Əməliyyatlar) saxlanılır. */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
  const api = useMemo<FiltersApi>(
    () => ({
      filters,
      setFilters,
      patch: (p) => setFilters((f) => ({ ...f, ...p })),
      reset: () => setFilters(EMPTY_FILTERS),
    }),
    [filters],
  );
  return <FiltersContext.Provider value={api}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersApi {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters FiltersProvider daxilində istifadə olunmalıdır");
  return ctx;
}
