import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";
import { SOLUTIONS } from "@/lib/marketing-data";

export const Route = createFileRoute("/solutions")({
  head: () => ({
    meta: [
      { title: "Solutions — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Seating and guest operations for weddings, conferences, galas, fundraisers, festivals, universities and large venues.",
      },
      { property: "og:title", content: "Solutions — Nexa Flow Seats" },
      {
        property: "og:description",
        content: "One seating console, tuned for every kind of event you run.",
      },
    ],
  }),
  component: SolutionsPage,
});

function SolutionsPage() {
  return (
    <MarketingPage>
      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="Solutions" title="Built for the rooms you actually run.">
            <p className="mt-4 max-w-[62ch] font-mono text-xs leading-relaxed text-muted-foreground">
              The same engine adapts to protocol seating, family dynamics, sponsor tables and
              festival zones.
            </p>
          </SectionHeading>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((s) => (
              <div
                key={s.name}
                className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary/40"
              >
                <h3 className="font-display text-base font-medium text-foreground">{s.name}</h3>
                <p className="mt-2 font-mono text-xs leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
