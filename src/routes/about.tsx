import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Why Nexa Flow Seats exists: seating is the hardest, most human part of event operations, and it deserves a real system.",
      },
      { property: "og:title", content: "About — Nexa Flow Seats" },
      {
        property: "og:description",
        content: "The team building the seating console for modern event operations.",
      },
    ],
  }),
  component: AboutPage,
});

const STATS = [
  { k: "Events run", v: "12,400+" },
  { k: "Guests seated", v: "3.1M" },
  { k: "Avg. plan time", v: "-84%" },
  { k: "Uptime", v: "99.98%" },
];

function AboutPage() {
  return (
    <MarketingPage>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="About" title="Seating is operations, not decoration.">
            <div className="mt-6 max-w-[68ch] space-y-4 font-mono text-xs leading-relaxed text-muted-foreground">
              <p>
                Every event team we met was running the most politically sensitive part of their job
                out of a spreadsheet and a printed chart that went stale the moment someone
                cancelled. Nexa Flow Seats was built to make the seating plan a living system
                instead of a document.
              </p>
              <p>
                We combine a real relationship model — families, couples, colleagues, conflicts,
                accessibility and dietary needs — with an AI engine that proposes arrangements you
                can inspect, score and override. On the day, the same plan drives QR check-in and a
                live floor view your staff can trust.
              </p>
              <p>
                The platform is multi-tenant and isolated at the database level, so agencies and
                venues can run every client organization from one login without data ever crossing
                over.
              </p>
            </div>
          </SectionHeading>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.k} className="bg-surface p-6">
                <p className="label-mono">{s.k}</p>
                <p className="mt-2 font-display text-3xl font-medium text-primary">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
