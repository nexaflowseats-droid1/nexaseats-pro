import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  packageId: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  method: z.enum(["mobile_money", "card"]),
  phoneNumber: z.string().trim().max(20).optional().nullable(),
  buyerName: z.string().trim().min(2).max(120),
  buyerEmail: z.string().trim().email().max(255),
  eventTitle: z.string().trim().max(160).optional().nullable(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  baseUrl: z.string().url().max(200),
});

export function normalisePhone(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("256") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  return null;
}

/** Creates an order + payment from DB-sourced package data, then starts the payment. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => checkoutSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createCollection } = await import("@/lib/payments.server");

    let phone: string | null = null;
    if (data.method === "mobile_money") {
      phone = normalisePhone(data.phoneNumber ?? "");
      if (!phone) throw new Error("Enter a valid mobile money number, e.g. 0772 123456.");
    }

    if (data.organizationId) {
      const { data: m } = await context.supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", data.organizationId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!m) throw new Error("You are not a member of this organization.");
    }

    const { data: pkg, error: pkgErr } = await supabaseAdmin
      .from("packages")
      .select("*")
      .eq("id", data.packageId)
      .eq("is_active", true)
      .maybeSingle();
    if (pkgErr || !pkg) throw new Error("This package is no longer available.");

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["usd_ugx_rate", "payment_currency"]);
    const rate = Number(settings?.find((s) => s.key === "usd_ugx_rate")?.value ?? 3800);
    const currency = settings?.find((s) => s.key === "payment_currency")?.value ?? "UGX";
    const amountUsd = Number(pkg.price);
    const { computeCharge } = await import("@/lib/billing");
    const amountCharged = computeCharge(amountUsd, rate);

    const reference = `NXS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        reference,
        user_id: context.userId,
        organization_id: data.organizationId,
        package_id: pkg.id,
        package_snapshot: pkg as never,
        amount_usd: amountUsd,
        amount_charged: amountCharged,
        charge_currency: currency,
        fx_rate: rate,
        status: "pending",
        buyer_name: data.buyerName,
        buyer_email: data.buyerEmail,
        event_title: data.eventTitle || null,
        event_date: data.eventDate || null,
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    const providerRef = crypto.randomUUID();
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        order_id: order.id,
        package_id: pkg.id,
        amount: amountCharged,
        currency,
        payment_method: data.method,
        phone_number: phone,
        provider_reference: providerRef,
        status: "pending",
      })
      .select("id")
      .single();
    if (payErr) throw new Error(payErr.message);

    try {
      const result = await createCollection({
        amount: amountCharged,
        reference: providerRef,
        method: data.method,
        phoneNumber: phone,
        country: "UG",
        currency,
        description: `NexaSeats ${pkg.name} — ${reference}`,
        callbackUrl: `${data.baseUrl}/api/public/payments/webhook`,
      });
      await supabaseAdmin
        .from("payments")
        .update({
          status: result.status === "successful" ? "processing" : "processing",
          provider_transaction_uuid: result.transactionUuid ?? null,
          redirect_url: result.redirectUrl ?? null,
          metadata: (result.raw ?? {}) as never,
        })
        .eq("id", payment.id);
      return {
        orderId: order.id,
        paymentId: payment.id,
        redirectUrl: data.method === "card" ? (result.redirectUrl ?? null) : null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment could not be started";
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed", failure_reason: message })
        .eq("id", payment.id);
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", order.id);
      throw new Error(`Payment Failed: ${message}`);
    }
  });

/** Server-side verification — asks the provider, never trusts the browser. */
export const checkPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("payments")
      .select("id")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!own) throw new Error("Payment not found");
    const { verifyAndSettle } = await import("@/lib/payments.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    await verifyAndSettle(data.paymentId, getRequestHeader("origin") ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("payments")
      .select("status, failure_reason, orders(reference, status, credits_granted, package_snapshot)")
      .eq("id", data.paymentId)
      .single();
    return p as unknown as {
      status: string;
      failure_reason: string | null;
      orders: { reference: string; status: string; credits_granted: boolean; package_snapshot: { name: string; event_limit: number } };
    };
  });
