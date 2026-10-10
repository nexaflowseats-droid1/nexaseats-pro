import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, EmptyState, Panel, StatCard } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Nexa Flow Seats" },
      { name: "description", content: "Event credits, orders and payment history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const [credits, orders] = await Promise.all([
        supabase.from("event_credits").select("*, packages(name)").order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, reference, status, amount_charged, charge_currency, created_at, package_snapshot")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return { credits: credits.data ?? [], orders: orders.data ?? [] };
    },
  });
  const now = Date.now();
  const active = (data?.credits ?? []).filter((c) => !c.expires_at || new Date(c.expires_at).getTime() > now);
  const remaining = active.reduce((s, c) => s + (c.credits_total - c.credits_used), 0);

  return (
    <AppShell title="Billing" subtitle="Event credits, orders and payments">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Event credits left" value={String(remaining)} tone="primary" />
          <StatCard label="Active packages" value={String(active.length)} />
          <StatCard label="Orders" value={String(data?.orders.length ?? 0)} tone="accent" />
        </div>
        <Panel
          title="Event credits"
          actions={
            <Link to="/pricing" className="rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground">
              Buy package
            </Link>
          }
        >
          {active.length === 0 ? (
            <EmptyState title="No active packages" body="Buy a package to add event credits." />
          ) : (
            <ul className="divide-y divide-border font-mono text-xs">
              {active.map((c) => (
                <li key={c.id} className="flex justify-between py-2">
                  <span className="text-foreground">{(c as any).packages?.name}</span>
                  <span className="text-muted-foreground">
                    {c.credits_total - c.credits_used}/{c.credits_total} left · up to {c.guest_limit} guests
                    {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Orders & receipts">
          {(data?.orders.length ?? 0) === 0 ? (
            <p className="font-mono text-xs text-subtle">No orders yet.</p>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left">
                  <th className="label-mono pb-2">Reference</th>
                  <th className="label-mono pb-2">Package</th>
                  <th className="label-mono pb-2">Amount</th>
                  <th className="label-mono pb-2">Status</th>
                  <th className="label-mono pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {data!.orders.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="py-2 text-foreground">{o.reference}</td>
                    <td className="py-2 text-muted-foreground">{(o.package_snapshot as { name?: string })?.name}</td>
                    <td className="py-2 text-muted-foreground">{formatMoney(o.amount_charged, o.charge_currency)}</td>
                    <td className={`py-2 capitalize ${o.status === "paid" ? "text-accent" : "text-subtle"}`}>{o.status}</td>
                    <td className="py-2 text-subtle">{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
