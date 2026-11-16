"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { formatMoney, parseAmount } from "@/lib/money";
import type { ThemeMode } from "@/types";
import { ChevronRight } from "./Icons";
import { PageHeader, Segmented, Skeleton } from "./ui";
import { SheetsSettings } from "./SheetsSettings";
import { todayISO } from "@/lib/dates";

export function SettingsView() {
  const store = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [rateError, setRateError] = useState("");

  const commitRate = () => {
    if (rate === null) return;
    const v = parseAmount(rate);
    if (!Number.isFinite(v) || v <= 0 || v > 1000) {
      setRateError("Məzənnə sıfırdan böyük düzgün rəqəm olmalıdır");
      return;
    }
    setRateError("");
    store.updateSettings({ usdRate: Math.round(v * 10000) / 10000 });
    setRate(null);
    toast.success("Məzənnə yadda saxlandı");
  };

  const exportData = () => {
    const blob = new Blob([store.exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budce-ehtiyat-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importData = async (file: File) => {
    if (file.size > 20_000_000) return toast.error("Fayl çox böyükdür (maks. 20MB)");
    const res = store.importBackup(await file.text());
    if (res.ok) toast.success("Ehtiyat nüsxə bərpa olundu (mövcud məlumatla birləşdirildi)");
    else toast.error(res.error);
  };

  return (
    <div className="page">
      <PageHeader title="Parametrlər" />
      {!store.ready ? (
        <div className="space-y-4" role="status" aria-label="Yüklənir"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
      ) : (
        <div className="space-y-4">
          <section className="card space-y-3" aria-labelledby="appearance">
            <h2 id="appearance" className="text-[17px] font-bold">Görünüş</h2>
            <Segmented<ThemeMode>
              label="Tema"
              value={store.settings.theme}
              onChange={(theme) => store.updateSettings({ theme })}
              options={[{ value: "system", label: "Sistem" }, { value: "light", label: "İşıqlı" }, { value: "dark", label: "Qaranlıq" }]}
            />
          </section>

          <section className="card space-y-2" aria-labelledby="rate">
            <h2 id="rate" className="text-[17px] font-bold">USD məzənnəsi</h2>
            <label htmlFor="usd-rate" className="label">1 USD = ? AZN</label>
            <div className="flex gap-2">
              <input
                id="usd-rate"
                className="input num"
                inputMode="decimal"
                value={rate ?? String(store.settings.usdRate).replace(".", ",")}
                aria-invalid={Boolean(rateError)}
                onChange={(e) => setRate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitRate()}
              />
              <button type="button" className="btn-primary" onClick={commitRate} disabled={rate === null}>Saxla</button>
            </div>
            {rateError && <p role="alert" className="field-error">{rateError}</p>}
            <p className="text-[12px] text-slate-500 dark:text-slate-400">Cari: 1 $ = {formatMoney(store.settings.usdRate, "AZN")}. Ümumi balans və analitika bu məzənnə ilə hesablanır.</p>
          </section>

          <section className="card !p-2" aria-label="İdarəetmə">
            <Link href="/accounts" className="flex min-h-[52px] items-center justify-between px-2 text-[16px] font-medium">Hesabları idarə et <ChevronRight className="text-slate-400" /></Link>
            <div className="mx-2 border-t border-slate-100 dark:border-slate-800" />
            <Link href="/settings/categories" className="flex min-h-[52px] items-center justify-between px-2 text-[16px] font-medium">Kateqoriyaları idarə et <ChevronRight className="text-slate-400" /></Link>
          </section>

          <SheetsSettings />

          <section className="card space-y-3" aria-labelledby="backup">
            <h2 id="backup" className="text-[17px] font-bold">Ehtiyat nüsxə</h2>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">Məlumat bu cihazın brauzerində saxlanılır. Mütəmadi ehtiyat nüsxə çıxarın və ya Google Sheets-ə sinxron edin.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary" onClick={exportData}>Yüklə (JSON)</button>
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>Bərpa et</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Ehtiyat nüsxə faylı seç" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = ""; }} />
          </section>

          {!store.persistent && (
            <p role="alert" className="rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Brauzer yaddaşı əlçatmazdır (private rejim?). Məlumat yalnız bu sessiya üçün saxlanılır.</p>
          )}
          <p className="px-1 text-center text-[12px] text-slate-400">Büdcə · v1.0</p>
        </div>
      )}
    </div>
  );
}
