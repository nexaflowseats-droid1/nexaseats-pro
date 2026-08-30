import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppShell, Panel, StatCard, EmptyState } from "@/components/app/AppShell";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, STATUS_TONE } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexa Flow Seats" },
      { name: "description", content: "Live overview of your events, guests and check-ins." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type Overview = {
  events: {
    id: string;
    name: string;
    event_date: string | null;
    status: string;
    venue: string | null;
  }[];
  totals: {
    events: number;
    upcoming: number;
    guests: number;
    checkedIn: number;
    pending: number;
    confirmed: number;
    declined: number;
    maybe: number;
  };
  recentCheckIns: { id: string; name: string; at: string }[];
  perEvent: { name: string; guests: number; checkedIn: number }[];
};

function useOverview(orgId: string | null) {
  return useQuery({
    queryKey: ["overview", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Overview> => {
      const { data: events, error: e1 } = await supabase
        .from("events")
        .select("id, name, event_date, status, venues(name)")
        .eq("organization_id", orgId!)
        .order("event_date", { ascending: true });
      if (e1) throw e1;
      const ids = (events ?? []).map((e) => e.id);

      const [{ data: guests, error: e2 }, { data: checkIns, error: e3 }] = await Promise.all([
        ids.length
          ? supabase.from("guests").select("id, event_id, rsvp_status").in("event_id", ids)
          : Promise.resolve({ data: [], error: null } as const),
        ids.length
          ? supabase
              .from("check_ins")
              .select("id, event_id, checked_in_at, guests(first_name, last_name)")
              .in("event_id", ids)
              .order("checked_in_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null } as const),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;

      const g = guests ?? [];
      const c = checkIns ?? [];
      const today = new Date().toISOString().slice(0, 10);

      return {
        events: (events ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          event_date: e.event_date,
          status: e.status,
          venue: (e.venues as { name: string } | null)?.name ?? null,
        })),
        totals: {
          events: events?.length ?? 0,
          upcoming: (events ?? []).filter(
            (e) => (e.event_date ?? "") >= today && e.status !== "archived",
          ).length,
          guests: g.length,
          checkedIn: c.length,
          pending: g.filter((x) => x.rsvp_status === "pending").length,
          confirmed: g.filter((x) => x.rsvp_status === "confirmed").length,
          declined: g.filter((x) => x.rsvp_status === "declined").length,
          maybe: g.filter((x) => x.rsvp_status === "maybe").length,
        },
        recentCheckIns: c.slice(0, 8).map((x) => {
          const guest = x.guests as { first_name: string; last_name: string } | null;
          return {
            id: x.id,
            name: guest ? `${guest.first_name} ${guest.last_name}` : "Guest",
            at: x.checked_in_at,
          };
        }),
        perEvent: (events ?? []).map((e) => ({
          name: e.name.length > 16 ? e.name.slice(0, 15) + "…" : e.name,
          guests: g.filter((x) => x.event_id === e.id).length,
          checkedIn: c.filter((x) => x.event_id === e.id).length,
        })),
      };
    },
  });
}

const RSVP_COLORS = ["var(--accent)", "var(--primary)", "var(--destructive)", "var(--subtle)"];

function DashboardPage() {
  const { currentOrgId, currentOrg } = useOrg();
  const { data, isLoading, error } = useOverview(currentOrgId);
  const queryClient = useQueryClient();

  // Realtime: refresh KPIs as check-ins and RSVPs land during a live event.
  useEffect(() => {
    if (!currentOrgId) return;
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "check_ins" }, () => {
        queryClient.invalidateQueries({ queryKey: ["overview", currentOrgId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["overview", currentOrgId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrgId, queryClient]);

  const t = data?.totals;
  const attendance = t && t.guests > 0 ? Math.round((t.checkedIn / t.guests) * 100) : 0;

  const rsvpData = t
    ? [
        { name: "Confirmed", value: t.confirmed },
        { name: "Pending", value: t.pending },
        { name: "Declined", value: t.declined },
        { name: "Maybe", value: t.maybe },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <AppShell
      title="Dashboard"
      subtitle={currentOrg ? `${currentOrg.organizations.name} · live operations` : "Loading…"}
      actions={
        <Link
          to="/events"
          className="rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright"
        >
          New event
        </Link>
      }
    >
      {error && (
        <p className="mb-4 rounded-[8px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
          Could not load dashboard data.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total events" value={isLoading ? "—" : (t?.events ?? 0)} />
        <StatCard
          label="Upcoming"
          value={isLoading ? "—" : (t?.upcoming ?? 0)}
          tone="primary"
        />
        <StatCard label="Total guests" value={isLoading ? "—" : (t?.guests ?? 0)} />
        <StatCard
          label="Checked in"
          value={isLoading ? "—" : (t?.checkedIn ?? 0)}
          tone="accent"
        />
        <StatCard label="Pending RSVPs" value={isLoading ? "—" : (t?.pending ?? 0)} />
        <StatCard label="Attendance" value={`${attendance}%`} tone="accent" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Upcoming events" className="lg:col-span-2">
          {isLoading ? (
            <p className="font-mono text-xs text-subtle">Loading…</p>
          ) : data && data.events.length > 0 ? (
            <ul className="divide-y divide-border">
              {data.events.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: e.id }}
                      className="block truncate font-display text-sm text-foreground hover:text-primary"
                    >
                      {e.name}
                    </Link>
                    <p className="font-mono text-[11px] text-subtle">
                      {formatDate(e.event_date)} · {e.venue ?? "Venue TBC"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
                      STATUS_TONE[e.status as keyof typeof STATUS_TONE] ?? "border-border"
                    }`}
                  >
                    {e.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No events yet"
              body="Create your first event to start managing guests and seating."
            />
          )}
        </Panel>

        <Panel title="RSVP breakdown">
          {rsvpData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rsvpData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                    {rsvpData.map((_, i) => (
                      <Cell key={i} fill={RSVP_COLORS[i % RSVP_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center font-mono text-xs text-subtle">No RSVP data yet.</p>
          )}
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
            {rsvpData.map((d, i) => (
              <li key={d.name} className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: RSVP_COLORS[i % RSVP_COLORS.length] }}
                />
                {d.name} · {d.value}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Attendance by event" className="lg:col-span-2">
          {data && data.perEvent.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.perEvent}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--subtle)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--subtle)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "var(--elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="guests" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="checkedIn" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center font-mono text-xs text-subtle">No data yet.</p>
          )}
        </Panel>

        <Panel title="Recent check-ins">
          {data && data.recentCheckIns.length > 0 ? (
            <ul className="space-y-2.5">
              {data.recentCheckIns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-foreground">{c.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-subtle">
                    {new Date(c.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center font-mono text-xs text-subtle">
              No check-ins recorded yet.
            </p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
