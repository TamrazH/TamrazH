import type { Currency } from "@/types";

export const CURRENCY_SYMBOL: Record<Currency, string> = { AZN: "₼", USD: "$" };

/** Float xətalarının yığılmaması üçün 2 onluq işarəyə yuvarlaqlaşdırma. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toCents(n: number): number {
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return c / 100;
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 1234.5 -> "1 234,50" (min. 2 onluq) */
export function formatNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(round2(value));
  const [int = "0", frac = ""] = abs.toFixed(fractionDigits).split(".");
  const body = frac ? `${groupThousands(int)},${frac}` : groupThousands(int);
  const negative = round2(value) < 0;
  return negative ? `-${body}` : body;
}

export interface FormatMoneyOptions {
  /** true olduqda müsbət ədədin önünə "+" qoyulur */
  showPlus?: boolean;
}

/** formatMoney(1234.5, "AZN") -> "1 234,50 ₼" */
export function formatMoney(
  value: number,
  currency: Currency,
  opts: FormatMoneyOptions = {},
): string {
  const rounded = round2(value);
  const sign = opts.showPlus && rounded > 0 ? "+" : "";
  const body = formatNumber(rounded);
  const sym = CURRENCY_SYMBOL[currency];
  // USD üçün "$" önə, AZN üçün "₼" arxaya (Azərbaycan yazı qaydası)
  if (currency === "USD") {
    return rounded < 0 ? `-$${body.slice(1)}` : `${sign}$${body}`;
  }
  return `${sign}${body} ${sym}`;
}

/**
 * İstifadəçi daxiletməsini ədədə çevirir.
 * Qəbul edir: "1234.56", "1234,56", "1 234,56", "1.234,56", "1,234.56".
 * Yanlışdırsa NaN qaytarır.
 */
export function parseAmount(input: string): number {
  const s = input.replace(/[\s  ]/g, "");
  if (!s || !/^[0-9.,]+$/.test(s)) return NaN;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const decimalPos = Math.max(lastDot, lastComma);
  if (decimalPos === -1) return Number(s);
  const decSep = s[decimalPos];
  const after = s.slice(decimalPos + 1);
  const before = s.slice(0, decimalPos);
  const otherSep = decSep === "." ? "," : ".";
  // "1.234" / "1,234" — yalnız bir ayırıcı və arxada düz 3 rəqəm: minlik ayırıcı ola bilər,
  // amma gündəlik istifadədə onluq kimi qəbul etmək daha təbiidir ("1,234" -> 1.234 ola bilər).
  // Qərar: əgər əvvəldə də eyni ayırıcı varsa -> minlik; yoxdursa onluq.
  if (before.includes(decSep as string)) return NaN;
  const cleanBefore = before.split(otherSep).join("");
  if (after.length === 0) return Number(cleanBefore);
  const n = Number(`${cleanBefore || "0"}.${after}`);
  return Number.isFinite(n) ? n : NaN;
}

/** Valyutanı AZN ekvivalentinə çevirir. */
export function toAzn(amount: number, currency: Currency, usdRate: number): number {
  return currency === "USD" ? round2(amount * usdRate) : amount;
}
