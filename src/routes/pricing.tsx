import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";
import {
  FEATURE_CATEGORIES,
  eventsLabel,
  featureValue,
  formatUsd,
  guestsLabel,
  usePricingPackages,
  validityLabel,
  type PackageFeature,
  type PricingPackage,
} from "@/lib/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Single event and Event Manager packages for seating, guest management and QR check-in. See every included and excluded feature.",
      },
      { property: "og:title", content: "Pricing — Nexa Flow Seats" },
      {
        property: "og:description",
        content: "Standard and Extended packages for one event or 5–10 events, with a full feature comparison.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function FeatureList({ items, included }: { items: PackageFeature[]; included: boolean }) {
  return (
    <ul className="space-y-1.5">
      {items.map((pf) => {
        const v = featureValue(pf);
        return (
          <li key={pf.features.id} className="flex items-start gap-2 font-mono text-[11px]">
            {included ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
            ) : (
              <X className="mt-0.5 size-3.5 shrink-0 text-subtle" />
            )}
            <span className={included ? "text-muted-foreground" : "text-subtle"}>
              {pf.features.name}
              {included && v && <span className="text-subtle"> · {v}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Collapsible({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-3 lg:border-0 lg:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left lg:pointer-events-none"
        aria-expanded={open}
      >
        <span className="label-mono">
          {title} — {count}
        </span>
        <ChevronDown className={`size-4 text-subtle transition-transform lg:hidden ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`mt-2 ${open ? "block" : "hidden"} lg:block`}>{children}</div>
    </div>
  );
}

function PackageCard({ pkg }: { pkg: PricingPackage }) {
  const inc = pkg.package_features.filter((f) => f.included);
  const exc = pkg.package_features.filter((f) => !f.included);
  const extended = pkg.tier === "extended";
  return (
    <div
      className={`flex flex-col rounded-xl border bg-surface p-5 ${
        extended ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-mono">{pkg.name}</span>
        {Number(pkg.savings) > 0 && (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-accent">
            Save {formatUsd(pkg.savings)}
          </span>
        )}
      </div>
      {pkg.description && <p className="mt-2 font-mono text-[11px] text-subtle">{pkg.description}</p>}
      <p className="mt-3 font-display text-3xl font-medium text-foreground">
        {formatUsd(pkg.price)}
        <span className="font-mono text-xs text-subtle">{pkg.event_limit === 1 ? " / event" : " total"}</span>
      </p>
      <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[11px] text-muted-foreground">
        <span>{eventsLabel(pkg)}</span>
        <span>{guestsLabel(pkg)}</span>
        <span>{validityLabel(pkg)}</span>
      </div>
      <div className="mt-4 flex-1 space-y-4">
        <Collapsible title="✓ What's included" count={inc.length}>
          <FeatureList items={inc} included />
        </Collapsible>
        {exc.length > 0 && (
          <Collapsible title="✕ What's not included" count={exc.length}>
            <FeatureList items={exc} included={false} />
          </Collapsible>
        )}
      </div>
      <Link
        to="/checkout"
        search={{ packageId: pkg.id }}
        className={`mt-5 rounded-[8px] px-4 py-2 text-center font-display text-sm font-semibold transition-colors ${
          extended
            ? "bg-primary text-primary-foreground hover:bg-primary-bright"
            : "border border-border text-foreground hover:bg-secondary"
        }`}
      >
        Select package
      </Link>
    </div>
  );
}

function Cell({ pf }: { pf?: PackageFeature }) {
  if (!pf) return <span className="text-subtle">—</span>;
  if (!pf.included) return <X className="mx-auto size-4 text-subtle" aria-label="Not included" />;
  const v = featureValue(pf);
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Check className="size-4 text-accent" aria-label="Included" />
      {v && <span className="text-[11px]">{v}</span>}
    </span>
  );
}

function Comparison({ title, packages }: { title: string; packages: PricingPackage[] }) {
  const features = packages[0]?.package_features.map((pf) => pf.features) ?? [];
  const row = (label: string, render: (p: PricingPackage) => React.ReactNode) => (
    <tr className="border-t border-border">
      <td className="py-2 pr-4 text-foreground">{label}</td>
      {packages.map((p) => (
        <td key={p.id} className="py-2 text-center text-muted-foreground">
          {render(p)}
        </td>
      ))}
    </tr>
  );
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-surface p-5 md:block">
      <h3 className="font-display text-lg text-foreground">{title}</h3>
      <table className="mt-4 w-full font-mono text-xs">
        <thead>
          <tr>
            <th className="pb-2 text-left label-mono">Feature</th>
            {packages.map((p) => (
              <th key={p.id} className="pb-2 text-center label-mono">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row("Price", (p) => formatUsd(p.price))}
          {row("Events", (p) => eventsLabel(p))}
          {row("Guest limit", (p) => `✓ Up to ${p.guest_limit.toLocaleString()} guests`)}
          {row("Validity", (p) => validityLabel(p))}
          {row("Savings", (p) => (Number(p.savings) > 0 ? `Save ${formatUsd(p.savings)}` : "—"))}
          {FEATURE_CATEGORIES.map((cat) => {
            const fs = features.filter((f) => f.category === cat);
            if (!fs.length) return null;
            return [
              <tr key={cat} className="border-t border-border">
                <td colSpan={packages.length + 1} className="pt-4 pb-1 label-mono text-primary">
                  {cat}
                </td>
              </tr>,
              ...fs.map((f) => (
                <tr key={f.id} className="border-t border-border/60">
                  <td className="py-2 pr-4 text-foreground">{f.name}</td>
                  {packages.map((p) => (
                    <td key={p.id} className="py-2 text-center">
                      <Cell pf={p.package_features.find((x) => x.features.id === f.id)} />
                    </td>
                  ))}
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function PricingPage() {
  const { data, isLoading, error } = usePricingPackages();
  const single = (data ?? []).filter((p) => p.group_label === "single");
  const manager = (data ?? []).filter((p) => p.group_label === "manager");

  return (
    <MarketingPage>
      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="Pricing" title="Know exactly what you're buying.">
            <p className="mt-4 max-w-[62ch] font-mono text-xs leading-relaxed text-muted-foreground">
              Every package lists what's included and what isn't. Pay once by Mobile Money or Card.
            </p>
          </SectionHeading>

          {isLoading && <p className="mt-10 font-mono text-xs text-subtle">Loading packages…</p>}
          {error && <p className="mt-10 font-mono text-xs text-destructive">Couldn't load packages. Refresh to try again.</p>}

          {single.length > 0 && (
            <>
              <h2 className="mt-12 label-mono">Single event</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {single.map((p) => (
                  <PackageCard key={p.id} pkg={p} />
                ))}
              </div>
            </>
          )}
          {manager.length > 0 && (
            <>
              <h2 className="mt-12 label-mono">Event Manager — multi-event packs</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {manager.map((p) => (
                  <PackageCard key={p.id} pkg={p} />
                ))}
              </div>
            </>
          )}

          <div className="mt-14 space-y-6">
            {single.length > 0 && <Comparison title="Full feature comparison — Standard vs Extended" packages={single} />}
            {manager.length > 0 && <Comparison title="Event Manager comparison" packages={manager} />}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
