import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";
import { FEATURES } from "@/lib/marketing-data";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Guest management, interactive seating design, AI seating intelligence, QR check-in, document generation and live analytics.",
      },
      { property: "og:title", content: "Features — Nexa Flow Seats" },
      {
        property: "og:description",
        content: "Everything Nexa Flow Seats does, from guest import to live floor operations.",
      },
    ],
  }),
  component: FeaturesPage,
});

const DETAIL = [
  {
    group: "Seating engine",
    items: [
      "Rooms, zones, tables and individual seats",
      "Drag, move, rotate and resize tables on a live canvas",
      "Must-sit-together and must-not-sit-together relationships",
      "Conflict detection with compatibility scoring",
    ],
  },
  {
    group: "Guest operations",
    items: [
      "CSV and Excel import with column mapping and duplicate detection",
      "Groups: families, couples, companies, teams, VIP",
      "RSVP pages with dietary, accessibility and plus-one capture",
      "Bulk actions, saved filters and tagging",
    ],
  },
  {
    group: "On the day",
    items: [
      "Per-guest QR codes and secure invitation links",
      "Fast scan check-in with duplicate protection",
      "Live arrival dashboard shared across staff devices",
      "Realtime seating and RSVP updates",
    ],
  },
];

function FeaturesPage() {
  return (
    <MarketingPage>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="Features" title="A console built for event operations teams.">
            <p className="mt-4 max-w-[62ch] font-mono text-xs leading-relaxed text-muted-foreground">
              Nexa Flow Seats replaces the spreadsheet, the printed chart and the clipboard at the
              door with one system that stays correct while the event is running.
            </p>
          </SectionHeading>

          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-surface p-6">
                <span
                  className={`size-1.5 rounded-full ${f.tone === "accent" ? "bg-accent" : "bg-primary"} inline-block`}
                />
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

      <section>
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {DETAIL.map((d) => (
              <div key={d.group} className="rounded-xl border border-border bg-surface p-6">
                <p className="label-mono">{d.group}</p>
                <ul className="mt-4 space-y-3">
                  {d.items.map((i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 font-mono text-xs leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
