import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
async function requireAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (data !== true) throw new Error("Administrator access required.");
}

/** Platform-wide stats and directories for the admin dashboard. */
export const adminPlatform = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [orgs, members, profiles, events, guests, checkIns, orders, payments, roles, contacts, audit] = await Promise.all([
      db.from("organizations").select("id, name, slug, plan, is_demo, created_at").order("created_at", { ascending: false }),
      db.from("organization_members").select("organization_id, user_id, role"),
      db.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
      db.from("events").select("id, name, status, event_date, organization_id, capacity, created_at").order("created_at", { ascending: false }).limit(500),
      db.from("guests").select("id", { count: "exact", head: true }),
      db.from("check_ins").select("id", { count: "exact", head: true }),
      db.from("orders").select("id, reference, user_id, buyer_email, buyer_name, status, amount_charged, charge_currency, amount_usd, package_snapshot, created_at, paid_at").order("created_at", { ascending: false }).limit(500),
      db.from("payments").select("id, order_id, payment_method, status, failure_reason, amount, currency, created_at").order("created_at", { ascending: false }).limit(500),
      db.from("user_roles").select("user_id, role"),
      db.from("contact_messages").select("id, name, email, company, message, created_at").order("created_at", { ascending: false }).limit(100),
      db.from("audit_logs").select("id, action, entity_type, organization_id, user_id, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      orgs: orgs.data ?? [],
      members: members.data ?? [],
      profiles: profiles.data ?? [],
      events: events.data ?? [],
      guestCount: guests.count ?? 0,
      checkInCount: checkIns.count ?? 0,
      orders: (orders.data ?? []) as any[],
      payments: payments.data ?? [],
      admins: (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      contacts: contacts.data ?? [],
      audit: audit.data ?? [],
    };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (!data.admin && data.userId === context.userId) throw new Error("You cannot remove your own admin access.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (data.admin) {
      const { error } = await db.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setOrgPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orgId: z.string().uuid(), plan: z.enum(["free", "professional", "business", "enterprise"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("organizations").update({ plan: data.plan }).eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPackageActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ packageId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("packages").update({ is_active: data.active }).eq("id", data.packageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
