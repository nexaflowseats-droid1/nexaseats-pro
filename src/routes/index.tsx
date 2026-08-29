import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";
import { ConsolePreview } from "@/components/marketing/ConsolePreview";
import { FEATURES, STEPS, PLANS } from "@/lib/marketing-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexa Flow Seats — Smart Seating. Seamless Events." },
      {
        name: "description",
        content:
          "Manage guests, design interactive seating, generate QR invitations and run events live from one AI-powered console.",
      },
      { property: "og:title", content: "Nexa Flow Seats — Smart Seating. Seamless Events." },
      {
        property: "og:description",
        content:
          "AI-powered event seating, guest management, QR check-in and real-time event operations.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <MarketingPage>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="gridbg-fade pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              AI seating engine · live
            </span>
            <h1 className="mt-6 text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Smart Seating.
              <br />
              <span className="text-primary">Seamless Events.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-[62ch] text-pretty font-mono text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Nexa Flow Seats helps event organizers manage guests, create intelligent seating
              arrangements, design interactive floor plans, generate QR invitations, manage event
              documents and run events seamlessly from one powerful platform.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-[8px] bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-bright"
              >
                Start Free <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/contact"
                className="rounded-[8px] border border-border px-5 py-2.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
              >
                Book a Demo
              </Link>
            </div>
          </div>

          <div className="mt-16">
            <ConsolePreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionHeading
            eyebrow="Capabilities"
            title="Every part of event operations, on one surface."
          />
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="bg-surface p-6 transition-colors hover:bg-elevated">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`size-1.5 rounded-full ${f.tone === "accent" ? "bg-accent" : "bg-primary"}`}
                  />
                </div>
                <h3 className="mt-4 font-display text-base font-medium text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionHeading eyebrow="Workflow" title="Six steps from empty room to live event." />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 font-mono text-xs text-primary ring-1 ring-primary/25">
                  {i + 1}
                </span>
                <span className="font-display text-sm text-foreground">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <SectionHeading eyebrow="Pricing" title="Priced per event volume, not per headache." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`flex flex-col rounded-xl border bg-surface p-6 ${
                  p.featured ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-subtle">
                    {p.name}
                  </span>
                  {p.featured && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">
                      popular
                    </span>
                  )}
                </div>
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
                  to="/auth"
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

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-7xl px-5 py-20 text-center sm:px-8">
          <h2 className="text-balance font-display text-3xl font-medium tracking-tight text-foreground">
            Run your next event from the console.
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] font-mono text-xs text-muted-foreground">
            Free to start. No card required. Sample event data included so you can explore
            immediately.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex items-center gap-2 rounded-[8px] bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-bright"
          >
            Start Free <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </MarketingPage>
  );
}
