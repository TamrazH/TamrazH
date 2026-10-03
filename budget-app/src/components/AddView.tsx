"use client";

import { useEffect, useState } from "react";
import type { TransactionType } from "@/types";
import { useStore } from "@/hooks/useStore";
import { PageHeader, Skeleton } from "./ui";
import { TransactionForm } from "./TransactionForm";

const VALID: TransactionType[] = ["expense", "income", "transfer", "investment", "balance"];

export function AddView() {
  const { ready } = useStore();
  const [preset, setPreset] = useState<TransactionType | undefined | null>(null);

  // ?type=income kimi sürətli keçidlər (Suspense tələb etməmək üçün window-dan oxuyuruq)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type") as TransactionType | null;
    setPreset(t && VALID.includes(t) ? t : undefined);
  }, []);

  return (
    <div className="page">
      <PageHeader title="Yeni əməliyyat" />
      {!ready || preset === null ? (
        <div className="space-y-4" role="status" aria-label="Yüklənir">
          <Skeleton className="h-12" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : (
        <TransactionForm presetType={preset} />
      )}
    </div>
  );
}
