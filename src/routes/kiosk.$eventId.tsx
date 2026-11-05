import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search } from "lucide-react";
import { BrandMark } from "@/components/marketing/SiteChrome";
import { findSeat, getKiosk, type SeatMatch } from "@/lib/event-experience.functions";
import { formatDate, formatTime } from "@/lib/queries";

export const Route = createFileRoute("/kiosk/$eventId")({
  head: () => ({
    meta: [
      { title: "Find your seat | Nexa Flow Seats" },
      { name: "description", content: "Search your name to find your table, see the floor plan and the event schedule." },
      { property: "og:title", content: "Find your seat | Nexa Flow Seats" },
      { property: "og:description", content: "Look up your table at the event entrance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KioskPage,
});

const W = 1240;
const H = 760;

function KioskPage() {
  const { eventId } = Route.useParams();
  const load = useServerFn(getKiosk);
  const find = useServerFn(findSeat);
  const { data, isLoading } = useQuery({
    queryKey: ["kiosk", eventId],
    queryFn: () => load({ data: { eventId } }),
    retry: false,
  });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<SeatMatch | null>(null);
  const search = useMutation({ mutationFn: () => find({ data: { eventId, query: q } }) });

  if (isLoading) return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>;
  if (!data)
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">Seat finder unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please ask a member of staff at the entrance for help.</p>
      </Shell>
    );

  return (
    <Shell>
      <p className="text-xs font-medium text-primary">Welcome to</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{data.event.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDate(data.event.event_date)} · {formatTime(data.event.start_time)}
        {data.event.venue ? ` · ${data.event.venue}` : ""}
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPicked(null);
          if (q.trim().length >= 2) search.mutate();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type your first or last name"
            aria-label="Your name"
            maxLength={60}
            className="w-full rounded-[10px] border border-input bg-background py-3 pl-9 pr-3 text-base text-foreground outline-none focus:border-primary/60"
          />
        </div>
        <button type="submit" className="rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Find my seat
        </button>
      </form>

      {search.data && (
        <ul className="mt-4 space-y-2">
          {search.data.length === 0 && (
            <li className="text-sm text-muted-foreground">No guest found with that name. Try your last name, or ask staff.</li>
          )}
          {search.data.map((m, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setPicked(m)}
                className={`flex w-full items-center justify-between rounded-[10px] border px-4 py-3 text-left ${
                  picked === m ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
              >
                <span className="text-sm font-medium text-foreground">{m.name}</span>
                <span className="text-sm text-primary">{m.tableName ?? "Seat not assigned yet"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data.tables.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Room layout</p>
          <div className="relative w-full overflow-hidden rounded-[12px] border border-border bg-elevated" style={{ aspectRatio: `${W}/${H}` }}>
            {data.elements.map((el) => (
              <div
                key={el.id}
                className="absolute grid place-items-center rounded-[6px] border border-dashed border-accent/60 bg-accent/10 text-[10px] text-accent"
                style={{ left: `${(el.x / W) * 100}%`, top: `${(el.y / H) * 100}%`, width: `${(el.w / W) * 100}%`, height: `${(el.h / H) * 100}%` }}
              >
                {el.kind === "dance" ? "Dance floor" : el.kind === "dj" ? "DJ" : el.kind.charAt(0).toUpperCase() + el.kind.slice(1)}
              </div>
            ))}
            {data.tables.map((t) => {
              const hit = picked?.tableId === t.id;
              return (
                <div
                  key={t.id}
                  className={`absolute grid place-items-center rounded-full border text-[10px] font-semibold transition-all ${
                    hit ? "z-10 scale-125 border-primary bg-primary text-primary-foreground shadow-lg" : "border-border bg-surface text-muted-foreground"
                  }`}
                  style={{ left: `${(t.x / W) * 100}%`, top: `${(t.y / H) * 100}%`, width: `${(132 / W) * 100}%`, aspectRatio: "1" }}
                >
                  {t.table_number}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.schedule.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tonight's schedule</p>
          <ol className="space-y-1.5">
            {data.schedule.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-14 shrink-0 font-medium text-primary">{s.time}</span>
                <span className="text-foreground">{s.title}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Nexa<span className="text-primary"> Flow</span> Seats
          </span>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
