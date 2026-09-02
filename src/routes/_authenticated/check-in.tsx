import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { supabase } from "@/integrations/supabase/client";
import { useCheckIns, useGuests } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/check-in")({
  head: () => ({
    meta: [
      { title: "Check-In — Nexa Flow Seats" },
      { name: "description", content: "Search guests, scan invitation codes and check in arrivals." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckInPage,
});

function CheckInPage() {
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: guests } = useGuests(eventId);
  const { data: checkIns } = useCheckIns(eventId);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`checkin-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "check_ins" }, () => {
        queryClient.invalidateQueries({ queryKey: ["check_ins", eventId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);

  const checkedInIds = useMemo(
    () => new Set((checkIns ?? []).map((c) => c.guest_id)),
    [checkIns],
  );

  const checkIn = useMutation({
    mutationFn: async (guestId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("check_ins").insert({
        event_id: eventId!,
        guest_id: guestId,
        checked_in_by: userData.user?.id ?? null,
        method: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guest checked in");
      queryClient.invalidateQueries({ queryKey: ["check_ins", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("check_ins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["check_ins", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const results = (guests ?? []).filter(
    (g) =>
      !q ||
      `${g.first_name} ${g.last_name} ${g.email ?? ""}`.toLowerCase().includes(q),
  );

  const total = guests?.length ?? 0;
  const attended = checkIns?.length ?? 0;

  return (
    <AppShell
      title="Check-In"
      subtitle="Live arrivals desk with realtime attendance"
      actions={<EventPicker events={events} eventId={eventId} onChange={setEventId} />}
    >
      {!eventId ? (
        <EmptyState title="No event selected" body="Pick an event to run its check-in desk." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Expected" value={total} />
            <StatCard label="Checked in" value={attended} tone="accent" />
            <StatCard label="Remaining" value={Math.max(0, total - attended)} tone="primary" />
            <StatCard
              label="Attendance"
              value={`${total ? Math.round((attended / total) * 100) : 0}%`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Find a guest">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email or invitation code…"
                className="w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60"
              />
              <ul className="mt-3 max-h-[420px] space-y-1.5 overflow-y-auto">
                {results.slice(0, 60).map((g) => {
                  const done = checkedInIds.has(g.id);
                  return (
                    <li
                      key={g.id}
                      className="flex items-center justify-between rounded-[8px] border border-border px-3 py-2"
                    >
                      <div>
                        <p className="font-display text-sm text-foreground">
                          {g.first_name} {g.last_name}
                          {g.vip_status && <span className="text-primary"> ★</span>}
                        </p>
                        <p className="font-mono text-[10px] text-subtle">{g.email ?? "no email"}</p>
                      </div>
                      {done ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-accent">
                          <CheckCircle2 className="size-3.5" /> in
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => checkIn.mutate(g.id)}
                          className="rounded-[8px] bg-primary px-3 py-1 font-mono text-[10px] uppercase text-primary-foreground hover:bg-primary-bright"
                        >
                          Check in
                        </button>
                      )}
                    </li>
                  );
                })}
                {results.length === 0 && (
                  <p className="font-mono text-xs text-subtle">No matching guests.</p>
                )}
              </ul>
            </Panel>

            <Panel title="Live arrivals">
              {(checkIns ?? []).length === 0 ? (
                <EmptyState title="No arrivals yet" body="Check-ins stream in here in realtime." />
              ) : (
                <ul className="max-h-[480px] divide-y divide-border/60 overflow-y-auto">
                  {(checkIns ?? []).map((c) => {
                    const g = c.guests as { first_name: string; last_name: string } | null;
                    return (
                      <li key={c.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="font-display text-sm text-foreground">
                            {g ? `${g.first_name} ${g.last_name}` : "Guest"}
                          </p>
                          <p className="font-mono text-[10px] text-subtle">
                            {new Date(c.checked_in_at).toLocaleTimeString()} · {c.method}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => undo.mutate(c.id)}
                          className="font-mono text-[10px] text-subtle hover:text-destructive"
                        >
                          Undo
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
