import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { useCheckIns, useGuests, useAssignments, useTables } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Nexa Flow Seats" },
      { name: "description", content: "RSVP, attendance and seating analytics for your events." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

const COLORS = ["#f5b14a", "#8ac27b", "#c85c4c", "#6b6b60"];

function AnalyticsPage() {
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: guests } = useGuests(eventId);
  const { data: checkIns } = useCheckIns(eventId);
  const { data: assignments } = useAssignments(eventId);
  const { data: tables } = useTables(eventId);

  const rsvpData = useMemo(() => {
    const counts = { confirmed: 0, pending: 0, declined: 0, maybe: 0 };
    for (const g of guests ?? []) counts[g.rsvp_status] += 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [guests]);

  const hourly = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const c of checkIns ?? []) {
      const h = `${new Date(c.checked_in_at).getHours()}:00`;
      buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }
    return [...buckets.entries()].map(([hour, count]) => ({ hour, count }));
  }, [checkIns]);

  const tableFill = (tables ?? []).map((t) => ({
    name: t.name,
    seated: (assignments ?? []).filter((a) => a.table_id === t.id).length,
    capacity: t.capacity,
  }));

  const total = guests?.length ?? 0;
  const attended = checkIns?.length ?? 0;

  return (
    <AppShell
      title="Analytics"
      subtitle="Attendance, RSVP and seating performance"
      actions={<EventPicker events={events} eventId={eventId} onChange={setEventId} />}
    >
      {!eventId ? (
        <EmptyState title="No event selected" body="Choose an event to see its analytics." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Guests" value={total} />
            <StatCard label="Attended" value={attended} tone="accent" />
            <StatCard
              label="Attendance rate"
              value={`${total ? Math.round((attended / total) * 100) : 0}%`}
              tone="primary"
            />
            <StatCard label="Seats assigned" value={assignments?.length ?? 0} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="RSVP breakdown">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rsvpData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                      {rsvpData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Check-ins by hour">
              {hourly.length === 0 ? (
                <EmptyState title="No check-ins yet" body="Arrival patterns appear during the event." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a22" />
                      <XAxis dataKey="hour" stroke="#6b6b60" fontSize={11} />
                      <YAxis stroke="#6b6b60" fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f5b14a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Table utilisation">
            {tableFill.length === 0 ? (
              <EmptyState title="No tables" body="Create tables in the Seating Designer." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tableFill}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a22" />
                    <XAxis dataKey="name" stroke="#6b6b60" fontSize={11} />
                    <YAxis stroke="#6b6b60" fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="capacity" fill="#2a2a22" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="seated" fill="#8ac27b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
