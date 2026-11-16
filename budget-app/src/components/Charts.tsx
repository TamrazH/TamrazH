"use client";

import type { CategorySlice, MonthBar } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
const MONTH_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

export function DonutChart({ slices, total }: { slices: CategorySlice[]; total: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="mx-auto h-44 w-44" role="img" aria-label={`Xərclər kateqoriyalar üzrə, cəmi ${formatMoney(total, "AZN")}`}>
      <circle cx="70" cy="70" r={R} fill="none" strokeWidth="22" className="stroke-slate-200 dark:stroke-slate-800" />
      {slices.map((s) => {
        const len = (s.percent / 100) * C;
        const el = (
          <circle
            key={s.categoryId}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C - Math.max(len - 1.5, 0.5)}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" className="fill-slate-500 text-[9px] dark:fill-slate-400">Cəmi xərc</text>
      <text x="70" y="82" textAnchor="middle" className="fill-slate-900 text-[12px] font-bold dark:fill-slate-100">{formatMoney(total, "AZN")}</text>
    </svg>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",")}k`;
  return String(Math.round(n));
}

/** Son aylar üzrə gəlir (yaşıl) və xərc (qırmızı) sütunları */
export function MonthBars({ bars, selected }: { bars: MonthBar[]; selected: string }) {
  const max = Math.max(1, ...bars.flatMap((b) => [b.income, b.expense]));
  const H = 110;
  const w = 340 / bars.length;
  return (
    <svg viewBox={`0 0 340 ${H + 38}`} className="w-full" role="img" aria-label="Son aylar üzrə gəlir və xərc sütunları">
      {[0.5, 1].map((f) => (
        <line key={f} x1="0" x2="340" y1={H - H * f + 14} y2={H - H * f + 14} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="3 4" />
      ))}
      {bars.map((b, i) => {
        const x = i * w + w / 2;
        const hi = (b.income / max) * H;
        const he = (b.expense / max) * H;
        const month = Number(b.month.slice(5)) - 1;
        const isSel = b.month === selected;
        return (
          <g key={b.month}>
            <rect x={x - 13} y={H - hi + 14} width="12" height={Math.max(hi, b.income > 0 ? 2 : 0)} rx="3" fill="#16a34a" />
            <rect x={x + 1} y={H - he + 14} width="12" height={Math.max(he, b.expense > 0 ? 2 : 0)} rx="3" fill="#e11d48" />
            <text x={x} y={H + 30} textAnchor="middle" className={`text-[10px] ${isSel ? "fill-brand-500 font-bold" : "fill-slate-500 dark:fill-slate-400"}`}>
              {MONTH_SHORT[month]}
            </text>
            {b.expense > 0 && (
              <text x={x + 7} y={H - he + 10} textAnchor="middle" className="fill-slate-500 text-[8px] dark:fill-slate-400">{compact(b.expense)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
