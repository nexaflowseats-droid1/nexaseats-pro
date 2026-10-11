// Pure billing rules shared by server and UI. No I/O here so it can be unit-tested.

export type Tier = "standard" | "extended";
export type ServiceSource = "override" | "inherited" | "blank";

/** Package-specific value wins; otherwise inherit the tier default; blank stays blank. */
export function resolveServiceValue(
  override: string | null | undefined,
  tierDefault: string | null | undefined,
): { value: string | null; source: ServiceSource } {
  const o = override?.trim();
  if (o) return { value: o, source: "override" };
  const d = tierDefault?.trim();
  if (d) return { value: d, source: "inherited" };
  return { value: null, source: "blank" };
}

/** UGX is charged in whole units. */
export function computeCharge(amountUsd: number, rate: number) {
  if (!(amountUsd > 0) || !(rate > 0)) throw new Error("Invalid amount or rate");
  return Math.round(amountUsd * rate);
}

/** Receipts always use the amounts stored on the order, never the current rate. */
export function receiptAmounts(order: { amount_usd: number | string; fx_rate: number | string; amount_charged: number | string }) {
  return {
    usd: Number(order.amount_usd),
    rate: Number(order.fx_rate),
    charged: Number(order.amount_charged),
  };
}

export const RECEIPT_NUMBER_RE = /^NXS-R-\d{4}-\d{6}$/;

export function formatReceiptNumber(year: number, seq: number) {
  return `NXS-R-${year}-${String(seq).padStart(6, "0")}`;
}

/** Credits are granted only for a verified successful payment and only once. */
export function shouldGrantCredits(paymentStatus: string, creditsAlreadyGranted: boolean) {
  return paymentStatus === "successful" && !creditsAlreadyGranted;
}

/** A receipt exists only for a paid order. */
export function canIssueReceipt(orderStatus: string, paymentStatus: string) {
  return orderStatus === "paid" && paymentStatus === "successful";
}

export const MAX_EMAIL_ATTEMPTS = 5;

/** Temporary failures (rate limit, server errors, network) may be retried. */
export function isRetryableEmailError(httpStatus: number | null) {
  return httpStatus === null || httpStatus === 429 || httpStatus >= 500;
}

/** Exponential backoff: 1, 2, 4, 8 minutes... capped; null when attempts are exhausted. */
export function nextRetryAt(attempt: number, now = Date.now()) {
  if (attempt >= MAX_EMAIL_ATTEMPTS) return null;
  return new Date(now + Math.min(60, 2 ** (attempt - 1)) * 60_000).toISOString();
}

export function refundStatus(totalCharged: number, refunded: number) {
  if (refunded <= 0) return "issued" as const;
  return refunded >= totalCharged ? ("refunded" as const) : ("partially_refunded" as const);
}

export const EMAIL_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  bounced: "Bounced",
};
