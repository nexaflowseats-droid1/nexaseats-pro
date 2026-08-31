import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { AppShell, Panel, StatCard, EmptyState } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageEvents } from "@/lib/org-context";
import {
  useEvent,
  useGuests,
  useCheckIns,
  useTables,
  useAssignments,
  useInvitations,
  formatDate,
  formatTime,
  STATUS_TONE,
  RSVP_TONE,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event details — Nexa Flow Seats" },
      { name: "description", content: "Overview, guests, seating and check-in for this event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventDetailPage,
});

const TABS = [
  "Overview",
  "Guests",
  "Seating",
  "Invitations",
  "Check-In",
  "Analytics",
  "Settings",
] as const;

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { role } = useOrg();
  const editable = canManageEvents(role);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  const { data: event, isLoading } = useEvent(eventId);
  const { data: guests } = useGuests(eventId);
  const { data: checkIns } = useCheckIns(eventId);
  const { data: tables } = useTables(eventId);
  const { data: assignments } = useAssignments(eventId);
  const { data: invitations } = useInvitations(eventId);

  const stats = useMemo(() => {
    const total = guests?.length ?? 0;
    const confirmed = (guests ?? []).filter((g) => g.rsvp_status === "confirmed").length;
    const pending = (guests ?? []).filter((g) => g.rsvp_status === "pending").length;
    const seated = assignments?.length ?? 0;
    const attended = checkIns?.length ?? 0;
    return {
      total,
      confirmed,
      pending,
      seated,
      attended,
      rate: total ? Math.round((attended / total) * 100) : 0,
    };
  }, [guests, assignments, checkIns]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("events").update(patch).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event saved");
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Event">
        <p className="font-mono text-xs text-subtle">Loading event…</p>
      </AppShell>
    );
  }
  if (!event) {
    return (
      <AppShell title="Event">
        <EmptyState title="Event not found" body="It may have been deleted or archived." />
      </AppShell>
    );
  }

  const venue = event.venues as { name: string; address: string | null } | null;

  return (
    <AppShell
      title={event.name}
      subtitle={`${formatDate(event.event_date)} · ${venue?.name ?? "No venue"}`}
      actions={
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All events
        </Link>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase transition-colors ${
              tab === t
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-subtle hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Guests" value={stats.total} />
            <StatCard label="Confirmed" value={stats.confirmed} tone="accent" />
            <StatCard label="Pending RSVP" value={stats.pending} tone="primary" />
            <StatCard label="Seated" value={stats.seated} />
            <StatCard label="Attendance" value={`${stats.rate}%`} tone="accent" />
          </div>
          <Panel title="Event brief">
            <dl className="grid gap-4 font-mono text-xs sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Status", event.status],
                ["Category", event.category ?? "—"],
                ["Date", formatDate(event.event_date)],
                ["Start", formatTime(event.start_time)],
                ["End", formatTime(event.end_time)],
                ["Capacity", event.capacity ?? "—"],
                ["Venue", venue?.name ?? "—"],
                ["Address", venue?.address ?? "—"],
                ["Tables", tables?.length ?? 0],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="label-mono">{k}</dt>
                  <dd className="mt-1 text-foreground">{String(v)}</dd>
                </div>
              ))}
            </dl>
            {event.description && (
              <p className="mt-4 border-t border-border pt-4 font-mono text-xs text-muted-foreground">
                {event.description}
              </p>
            )}
          </Panel>
        </div>
      )}

      {tab === "Guests" && (
        <Panel
          title={`Guest list (${stats.total})`}
          actions={
            <Link to="/guests" className="font-mono text-[11px] text-primary hover:underline">
              Manage guests →
            </Link>
          }
        >
          {(guests ?? []).length === 0 ? (
            <EmptyState title="No guests yet" body="Add or import guests from the Guests module." />
          ) : (
            <ul className="divide-y divide-border/60">
              {(guests ?? []).slice(0, 25).map((g) => (
                <li key={g.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-display text-sm text-foreground">
                      {g.first_name} {g.last_name} {g.vip_status && <span className="text-primary">★</span>}
                    </p>
                    <p className="font-mono text-[10px] text-subtle">{g.email ?? "no email"}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${RSVP_TONE[g.rsvp_status]}`}
                  >
                    {g.rsvp_status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Seating" && (
        <Panel
          title={`Tables (${tables?.length ?? 0})`}
          actions={
            <Link to="/seating" className="font-mono text-[11px] text-primary hover:underline">
              Open designer →
            </Link>
          }
        >
          {(tables ?? []).length === 0 ? (
            <EmptyState title="No tables" body="Create tables in the Seating Designer." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(tables ?? []).map((t) => {
                const seated = (assignments ?? []).filter((a) => a.table_id === t.id).length;
                return (
                  <div key={t.id} className="rounded-[10px] border border-border bg-elevated p-3">
                    <p className="font-display text-sm text-foreground">{t.name}</p>
                    <p className="font-mono text-[10px] text-subtle">
                      {seated}/{t.capacity} seated · {t.table_type}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {tab === "Invitations" && (
        <Panel
          title={`Invitations (${invitations?.length ?? 0})`}
          actions={
            <Link to="/invitations" className="font-mono text-[11px] text-primary hover:underline">
              Manage →
            </Link>
          }
        >
          {(invitations ?? []).length === 0 ? (
            <EmptyState title="No invitations" body="Generate invitations from the Invitations module." />
          ) : (
            <ul className="divide-y divide-border/60 font-mono text-xs">
              {(invitations ?? []).slice(0, 20).map((i) => {
                const g = i.guests as { first_name: string; last_name: string } | null;
                return (
                  <li key={i.id} className="flex justify-between py-2">
                    <span className="text-foreground">
                      {g ? `${g.first_name} ${g.last_name}` : "Guest"}
                    </span>
                    <span className="text-subtle uppercase">{i.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Check-In" && (
        <Panel
          title={`Check-ins (${stats.attended})`}
          actions={
            <Link to="/check-in" className="font-mono text-[11px] text-primary hover:underline">
              Open check-in →
            </Link>
          }
        >
          {(checkIns ?? []).length === 0 ? (
            <EmptyState title="No check-ins yet" body="Check-ins appear live during your event." />
          ) : (
            <ul className="divide-y divide-border/60 font-mono text-xs">
              {(checkIns ?? []).slice(0, 20).map((c) => {
                const g = c.guests as { first_name: string; last_name: string } | null;
                return (
                  <li key={c.id} className="flex justify-between py-2">
                    <span className="text-foreground">
                      {g ? `${g.first_name} ${g.last_name}` : "Guest"}
                    </span>
                    <span className="text-subtle">
                      {new Date(c.checked_in_at).toLocaleTimeString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Analytics" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="RSVP confirmed" value={stats.confirmed} tone="accent" />
          <StatCard label="RSVP pending" value={stats.pending} tone="primary" />
          <StatCard label="Seats assigned" value={stats.seated} />
          <StatCard label="Attendance rate" value={`${stats.rate}%`} tone="accent" />
        </div>
      )}

      {tab === "Settings" && (
        <Panel title="Event settings">
          {!editable ? (
            <p className="font-mono text-xs text-subtle">
              Your role can view this event but not change its settings.
            </p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({
                  name: String(fd.get("name") ?? "").trim().slice(0, 120),
                  description: String(fd.get("description") ?? "").slice(0, 2000) || null,
                  status: String(fd.get("status")),
                });
              }}
            >
              <label className="sm:col-span-2">
                <span className="label-mono">Event name</span>
                <input
                  name="name"
                  defaultValue={event.name}
                  maxLength={120}
                  className="mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="label-mono">Description</span>
                <textarea
                  name="description"
                  rows={3}
                  maxLength={2000}
                  defaultValue={event.description ?? ""}
                  className="mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60"
                />
              </label>
              <label>
                <span className="label-mono">Status</span>
                <select
                  name="status"
                  defaultValue={event.status}
                  className="mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60"
                >
                  {Object.keys(STATUS_TONE).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
                >
                  {save.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
