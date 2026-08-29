import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";
import { PLANS } from "@/lib/marketing-data";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Free, Professional, Business and Enterprise plans for event seating, guest management and QR check-in.",
      },
      { property: "og:title", content: "Pricing — Nexa Flow Seats" },
      {
        property: "og:description",
        content: "Start free, scale to unlimited events and white-labelled enterprise deployments.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <MarketingPage>
      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="Pricing" title="Start free. Scale when the room does.">
            <p className="mt-4 max-w-[62ch] font-mono text-xs leading-relaxed text-muted-foreground">
              Every plan includes the seating designer, guest records and secure guest links.
            </p>
          </SectionHeading>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col rounded-xl border bg-surface p-6 ${
                  p.featured ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <span className="label-mono">{p.name}</span>
                <p className="mt-4 font-display text-3xl font-medium text-foreground">
                  {p.price}
                  <span className="font-mono text-xs text-subtle">{p.suffix}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2">
                  {p.items.map((it) => (
                    <li
                      key={it}
                      className="flex items-start gap-2 font-mono text-xs text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      {it}
                    </li>
                  ))}
                </ul>
                <Link
                  to={p.name === "Enterprise" ? "/contact" : "/auth"}
                  className={`mt-6 rounded-[8px] px-4 py-2 text-center font-display text-sm font-semibold transition-colors ${
                    p.featured
                      ? "bg-primary text-primary-foreground hover:bg-primary-bright"
                      : "border border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
