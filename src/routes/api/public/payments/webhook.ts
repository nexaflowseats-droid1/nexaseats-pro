import { createFileRoute } from "@tanstack/react-router";

// Payment callback. The body is only used to identify the payment; the actual
// status is always re-fetched from the provider before anything is settled.
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid body", { status: 400 });
        }
        const tx = body?.transaction ?? body?.data?.transaction ?? {};
        const reference: unknown = tx?.reference ?? body?.reference;
        const uuid: unknown = tx?.uuid ?? body?.uuid;
        if (typeof reference !== "string" && typeof uuid !== "string") {
          return new Response("Missing reference", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin.from("payments").select("id");
        q =
          typeof reference === "string" && /^[0-9a-f-]{36}$/i.test(reference)
            ? q.eq("provider_reference", reference)
            : q.eq("provider_transaction_uuid", String(uuid));
        const { data: payment } = await q.maybeSingle();
        if (!payment) return Response.json({ ok: true, ignored: true });

        const { verifyAndSettle } = await import("@/lib/payments.server");
        const result = await verifyAndSettle(payment.id, new URL(request.url).origin);
        return Response.json({ ok: true, status: result.status });
      },
    },
  },
});
