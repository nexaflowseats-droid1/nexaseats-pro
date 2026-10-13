import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return data === true;
}
async function requireAdmin(ctx: Ctx) {
  if (!(await isAdmin(ctx))) throw new Error("Administrator access required.");
}
/** RLS-scoped visibility check: the caller can only reach receipts they may read. */
async function visibleReceipt(ctx: Ctx, receiptId: string) {
  const { data } = await ctx.supabase
    .from("receipts").select("id, user_id, organization_id").eq("id", receiptId).maybeSingle();
  if (!data) throw new Error("Receipt not found.");
  return data as { id: string; user_id: string; organization_id: string | null };
}
async function origin() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return getRequestHeader("origin") ?? "https://nexaseats-pro.lovable.app";
}

export const getReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ receiptId: z.string().uuid(), download: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await visibleReceipt(context, data.receiptId);
    const { signedReceiptUrl } = await import("@/lib/receipts.server");
    return { url: await signedReceiptUrl(data.receiptId, data.download) };
  });

/** Customer-requested resend: reuses the same receipt; never touches orders, payments or credits. */
export const resendReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ receiptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await visibleReceipt(context, data.receiptId);
    const admin = await isAdmin(context);
    if (!admin && r.user_id !== context.userId) {
      if (!r.organization_id) throw new Error("Not allowed.");
      const { data: owner } = await context.supabase.rpc("has_org_role", { _org: r.organization_id, _role: "owner" });
      if (!owner) throw new Error("Only the buyer, an organization owner or an administrator can resend receipts.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 2 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("receipt_emails").select("id", { count: "exact", head: true })
      .eq("receipt_id", r.id).eq("kind", "resend").gte("created_at", since);
    if ((count ?? 0) > 0) throw new Error("A resend was just requested. Please wait a couple of minutes.");
    const { data: rec } = await supabaseAdmin.from("receipts").select("order_id, orders(buyer_email)").eq("id", r.id).single();
    const to = (rec as any)?.orders?.buyer_email as string | null;
    if (!to) throw new Error("No billing email on this order.");
    const { data: row, error } = await supabaseAdmin
      .from("receipt_emails")
      .insert({ receipt_id: r.id, order_id: rec!.order_id, kind: "resend", recipient: to, requested_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    const { deliverEmail } = await import("@/lib/receipts.server");
    const status = await deliverEmail(row.id, await origin());
    return { status };
  });

/** Retries a failed email attempt in place (bounded attempts). */
export const retryReceiptEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ emailId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: e } = await context.supabase.from("receipt_emails").select("id, receipt_id, status").eq("id", data.emailId).maybeSingle();
    if (!e) throw new Error("Email record not found.");
    const r = await visibleReceipt(context, e.receipt_id);
    if (!(await isAdmin(context)) && r.user_id !== context.userId) throw new Error("Not allowed.");
    if (e.status !== "failed") throw new Error("Only failed emails can be retried.");
    const { deliverEmail } = await import("@/lib/receipts.server");
    return { status: await deliverEmail(e.id, await origin()) };
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ admin: await isAdmin(context) }));

const SETTING_KEYS = [
  "business_email", "business_website", "business_address", "business_phone",
  "support_email", "refund_policy_url", "receipt_sender",
  "setup_time_standard", "setup_time_extended", "support_standard", "support_extended",
  "usd_ugx_rate",
] as const;

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [settings, packages, receipts] = await Promise.all([
      supabaseAdmin.from("app_settings").select("key, value").in("key", [...SETTING_KEYS]),
      supabaseAdmin.from("packages").select("id, name, tier, group_label, setup_time, support_level, sort_order").order("sort_order"),
      supabaseAdmin
        .from("receipts")
        .select("id, receipt_number, status, issued_at, orders(id, reference, buyer_email, buyer_name, amount_charged, charge_currency, package_snapshot), payments(provider_reference, payment_method), receipt_emails(id, kind, status, attempt_count, failure_reason, last_attempt_at, recipient)")
        .order("issued_at", { ascending: false })
        .limit(100),
    ]);
    const s: Record<string, string> = {};
    for (const r of settings.data ?? []) s[r.key] = r.value ?? "";
    return { settings: s, packages: packages.data ?? [], receipts: (receipts.data ?? []) as any[] };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      values: z.record(z.enum(SETTING_KEYS), z.string().trim().max(300)),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.values.usd_ugx_rate !== undefined && !(Number(data.values.usd_ugx_rate) > 0)) throw new Error("Exchange rate must be a positive number.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const [key, value] of Object.entries(data.values)) {
      const { error } = await supabaseAdmin.from("app_settings").upsert({ key, value: value || null, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const savePackageService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      packageId: z.string().uuid(),
      setupTime: z.string().trim().max(80),
      supportLevel: z.string().trim().max(80),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("packages")
      .update({ setup_time: data.setupTime || null, support_level: data.supportLevel || null })
      .eq("id", data.packageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ receiptId: z.string().uuid(), amount: z.number().positive(), reason: z.string().trim().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("receipts").select("id, order_id, payment_id, organization_id, orders(amount_charged, charge_currency)").eq("id", data.receiptId).single();
    if (!r) throw new Error("Receipt not found.");
    const order = (r as any).orders as { amount_charged: number; charge_currency: string };
    const { data: prev } = await supabaseAdmin.from("refunds").select("amount").eq("order_id", r.order_id);
    const already = (prev ?? []).reduce((s, x) => s + Number(x.amount), 0);
    if (already + data.amount > Number(order.amount_charged)) throw new Error("Refund exceeds the amount paid.");
    await supabaseAdmin.from("refunds").insert({
      order_id: r.order_id, payment_id: r.payment_id, amount: data.amount, currency: order.charge_currency,
      reason: data.reason ?? null, created_by: context.userId,
    });
    const { refundStatus } = await import("@/lib/billing");
    await supabaseAdmin.from("receipts").update({ status: refundStatus(Number(order.amount_charged), already + data.amount) }).eq("id", r.id);
    if (r.organization_id) {
      await supabaseAdmin.from("audit_logs").insert({ organization_id: r.organization_id, user_id: context.userId, action: "refund.recorded", entity_type: "receipt", entity_id: r.id });
    }
    return { ok: true };
  });
