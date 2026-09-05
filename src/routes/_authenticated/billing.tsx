import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Panel, StatCard } from "@/components/app/AppShell";
import { useOrg, canManageOrg } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Nexa Flow Seats" },
      { name: "description", content: "Review your plan, usage limits and upgrade options." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

const PLANS = [
  {
    name: "Free",
    price: "$0",
    features: ["1 event", "Up to 50 guests", "Basic seating", "Basic QR codes"],
  },
  {
    name: "Professional",
    price: "$49",
    features: ["Up to 1,000 guests", "Advanced seating", "QR check-in", "PDF generation", "Analytics"],
  },
  {
    name: "Business",
    price: "$149",
    features: ["Unlimited events", "Unlimited guests", "Advanced analytics", "Team management"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    features: ["White labeling", "Custom branding", "Custom integrations", "Dedicated support"],
  },
];

function BillingPage() {
  const { currentOrg, role } = useOrg();
  const admin = canManageOrg(role);
  const current = currentOrg?.organizations.plan ?? "free";

  return (
    <AppShell title="Billing" subtitle="Plan, usage and invoices">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Current plan" value={current.toUpperCase()} tone="primary" />
          <StatCard label="Billing cycle" value="Monthly" />
          <StatCard label="Status" value="Active" tone="accent" />
        </div>

        <Panel title="Plans">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => {
              const active = p.name.toLowerCase() === current.toLowerCase();
              return (
                <div
                  key={p.name}
                  className={`rounded-xl border p-4 ${
                    active ? "border-primary/50 bg-primary/5" : "border-border bg-elevated"
                  }`}
                >
                  <p className="label-mono">{p.name}</p>
                  <p className="mt-1 font-display text-2xl font-medium text-foreground">
                    {p.price}
                    {p.price.startsWith("$") && p.price !== "$0" && (
                      <span className="font-mono text-[11px] text-subtle"> /mo</span>
                    )}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {p.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-1.5 font-mono text-[11px] text-muted-foreground"
                      >
                        <Check className="mt-0.5 size-3 shrink-0 text-accent" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={active || !admin}
                    onClick={() =>
                      toast.info("Checkout isn't connected yet — tell us to enable payments.")
                    }
                    className={`mt-4 w-full rounded-[8px] px-3 py-2 font-display text-xs font-semibold transition-colors ${
                      active
                        ? "bg-secondary text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:bg-primary-bright disabled:opacity-50"
                    }`}
                  >
                    {active ? "Current plan" : "Choose plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Invoices">
          <p className="font-mono text-xs text-subtle">
            No invoices yet. Once payments are enabled, receipts appear here.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
