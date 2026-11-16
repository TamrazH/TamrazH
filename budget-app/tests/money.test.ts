import { describe, expect, it } from "vitest";
import { formatMoney, formatNumber, parseAmount, round2, toAzn } from "@/lib/money";

const NBSP = " ";

describe("formatMoney", () => {
  it("AZN: minlik boşluq, onluq vergül, ₼ sonda", () => {
    expect(formatMoney(1234.5, "AZN")).toBe(`1${NBSP}234,50${NBSP}₼`);
    expect(formatMoney(0, "AZN")).toBe(`0,00${NBSP}₼`);
  });
  it("USD: $ öndə", () => {
    expect(formatMoney(1234567.891, "USD")).toBe(`$1${NBSP}234${NBSP}567,89`);
  });
  it("mənfi və + işarəsi", () => {
    expect(formatMoney(-50, "AZN")).toBe(`-50,00${NBSP}₼`);
    expect(formatMoney(-50, "USD")).toBe("-$50,00");
    expect(formatMoney(50, "AZN", { showPlus: true })).toBe(`+50,00${NBSP}₼`);
  });
  it("formatNumber NaN üçün tire", () => {
    expect(formatNumber(NaN)).toBe("—");
  });
});

describe("parseAmount", () => {
  it.each([
    ["12.5", 12.5],
    ["12,5", 12.5],
    ["1 234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1000", 1000],
    ["0,05", 0.05],
  ])("%s -> %d", (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 5);
  });
  it.each(["", "abc", "-5", "1..2", "12,3,4", "1.234.567"])("yanlış: %j", (input) => {
    expect(Number.isNaN(parseAmount(input))).toBe(true);
  });
});

describe("round2/toAzn", () => {
  it("float xətasız yuvarlaqlaşdırır", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });
  it("USD -> AZN", () => {
    expect(toAzn(100, "USD", 1.7)).toBe(170);
    expect(toAzn(100, "AZN", 1.7)).toBe(100);
  });
});
