import { describe, expect, it } from "vitest";
import {
  canIssueReceipt,
  computeCharge,
  formatReceiptNumber,
  isRetryableEmailError,
  nextRetryAt,
  receiptAmounts,
  RECEIPT_NUMBER_RE,
  refundStatus,
  resolveServiceValue,
  shouldGrantCredits,
} from "./billing";

describe("package service values", () => {
  it("multi-event packs inherit the tier default", () => {
    expect(resolveServiceValue(null, "Within 24 hours")).toEqual({ value: "Within 24 hours", source: "inherited" });
  });
  it("a package override wins over the tier default", () => {
    expect(resolveServiceValue("Within 6 hours", "Within 12 hours")).toEqual({ value: "Within 6 hours", source: "override" });
  });
  it("blank stays blank — never invented", () => {
    expect(resolveServiceValue("", null)).toEqual({ value: null, source: "blank" });
  });
});

describe("UGX charge", () => {
  it("Standard $49.99 at 3800 = UGX 189,962", () => {
    expect(computeCharge(49.99, 3800)).toBe(189962);
  });
  it("10 Events Extended $800 at 3800 = UGX 3,040,000", () => {
    expect(computeCharge(800, 3800)).toBe(3040000);
  });
});

describe("historical exchange rate", () => {
  it("receipt uses the rate stored on the order", () => {
    const r = receiptAmounts({ amount_usd: "49.99", fx_rate: "3700", amount_charged: "184963" });
    expect(r).toEqual({ usd: 49.99, rate: 3700, charged: 184963 });
  });
});

describe("receipt numbering", () => {
  it("formats sequential receipt numbers", () => {
    expect(formatReceiptNumber(2026, 1001)).toBe("NXS-R-2026-001001");
    expect(RECEIPT_NUMBER_RE.test("NXS-R-2026-001001")).toBe(true);
  });
});

describe("credits and receipts", () => {
  it("grants credits only once for a successful payment", () => {
    expect(shouldGrantCredits("successful", false)).toBe(true);
    expect(shouldGrantCredits("successful", true)).toBe(false);
    expect(shouldGrantCredits("failed", false)).toBe(false);
    expect(shouldGrantCredits("processing", false)).toBe(false);
  });
  it("no receipt for failed or pending payments", () => {
    expect(canIssueReceipt("paid", "successful")).toBe(true);
    expect(canIssueReceipt("pending", "processing")).toBe(false);
    expect(canIssueReceipt("failed", "failed")).toBe(false);
  });
});

describe("email retries", () => {
  it("retries temporary errors only", () => {
    expect(isRetryableEmailError(503)).toBe(true);
    expect(isRetryableEmailError(429)).toBe(true);
    expect(isRetryableEmailError(null)).toBe(true);
    expect(isRetryableEmailError(422)).toBe(false);
  });
  it("stops after 5 attempts", () => {
    expect(nextRetryAt(5)).toBeNull();
    expect(nextRetryAt(1, 0)).toBe(new Date(60_000).toISOString());
  });
});

describe("refunds", () => {
  it("partial and full refund statuses", () => {
    expect(refundStatus(100, 0)).toBe("issued");
    expect(refundStatus(100, 40)).toBe("partially_refunded");
    expect(refundStatus(100, 100)).toBe("refunded");
  });
});
