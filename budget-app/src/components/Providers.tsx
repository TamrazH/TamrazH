"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/hooks/useToast";
import { StoreProvider } from "@/hooks/useStore";
import { FiltersProvider } from "@/hooks/useFilters";
import { ThemeEffect } from "./ThemeEffect";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreProvider>
        <FiltersProvider>
          <ThemeEffect />
          {children}
        </FiltersProvider>
      </StoreProvider>
    </ToastProvider>
  );
}
