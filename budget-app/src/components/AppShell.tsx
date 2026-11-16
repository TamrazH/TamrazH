"use client";

import { useCallback, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { PullToRefresh } from "./PullToRefresh";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { useKeyboardAvoidance } from "@/hooks/useKeyboard";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { useOnline } from "@/hooks/useOnline";

export function AppShell({ children }: { children: ReactNode }) {
  useKeyboardAvoidance();
  const { reload, syncNow, sync, settings } = useStore();
  const toast = useToast();
  const online = useOnline();

  const onRefresh = useCallback(async () => {
    await reload();
    if (online && (settings.autoSync || sync.lastSyncAt)) {
      const ok = await syncNow();
      if (ok) toast.success("Yeniləndi və sinxron edildi");
      else toast.error("Sinxron alınmadı — Parametrlərə baxın");
    } else {
      toast.success("Yeniləndi");
    }
  }, [reload, syncNow, online, settings.autoSync, sync.lastSyncAt, toast]);

  return (
    <>
      {!online && (
        <div
          role="status"
          className="bg-amber-500 px-4 pb-1.5 text-center text-[13px] font-semibold text-white"
          style={{ paddingTop: "calc(var(--safe-top) + 6px)" }}
        >
          Oflayn rejim — məlumat cihazda saxlanılır
        </div>
      )}
      <PullToRefresh onRefresh={onRefresh}>
        <main className="mx-auto min-h-dvh max-w-lg">{children}</main>
      </PullToRefresh>
      <BottomNav />
      <ServiceWorkerRegister />
    </>
  );
}
