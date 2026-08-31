import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Copy, Archive, Trash2 } from "lucide-react";
import { AppShell, Panel, EmptyState } from "@/components/app/AppShell";
import { useOrg, canManageEvents } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import { useEvents, useVenues, formatDate, STATUS_TONE, type EventStatus } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/events/")({
  head: () => ({
    meta: [
      { title: "Events — Nexa Flow Seats" },
      { name: "description", content: "Create, publish and manage every event in your workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventsPage,
});

const CATEGORIES = [
  "Wedding",
  "Corporate",
  "Conference",
  "Gala",
  "Awards",
  "Fundraiser",
  "Concert",
  "Festival",
  "Birthday",
  "Religious",
  "Government",
  "University",
];

const STATUSES: EventStatus[] = [
  "draft",
  "published",
  "upcoming",
  "live",
  "completed",
  "archived",
];

const eventSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(60).optional(),
  event_date: z.string().min(1, "Pick a date"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  capacity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  venue_id: z.string().uuid().optional(),
});

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60";

function EventsPage() {
  const { currentOrgId, role } = useOrg();
  const { data: events, isLoading } = useEvents(currentOrgId);
  const { data: venues } = useVenues(currentOrgId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editable = canManageEvents(role);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["events", currentOrgId] });

  const createEvent = useMutation({
    mutationFn: async (values: z.infer<typeof eventSchema>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("events").insert({
        organization_id: currentOrgId!,
        created_by: userData.user?.id ?? null,
        name: values.name,
        description: values.description || null,
        ...(values.category ? { category: values.category } : {}),
        event_date: values.event_date,
        start_time: values.start_time || null,
        end_time: values.end_time || null,
        ...(values.capacity === undefined ? {} : { capacity: values.capacity }),
        venue_id: values.venue_id || null,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event created");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EventStatus }) => {
      const { error } = await supabase.from("events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateEvent = useMutation({
    mutationFn: async (id: string) => {
      const source = events?.find((e) => e.id === id);
      if (!source) throw new Error("Event not found");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("events").insert({
        organization_id: source.organization_id,
        created_by: userData.user?.id ?? null,
        name: `${source.name} (copy)`,
        description: source.description,
        category: source.category,
        event_date: source.event_date,
        start_time: source.start_time,
        end_time: source.end_time,
        capacity: source.capacity,
        venue_id: source.venue_id,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event duplicated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const cleaned = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v]),
    );
    const parsed = eventSchema.safeParse(cleaned);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    createEvent.mutate(parsed.data);
  }

  const visible = (events ?? []).filter((e) => filter === "all" || e.status === filter);

  return (
    <AppShell
      title="Events"
      subtitle="Create, publish and run your event calendar"
      actions={
        editable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright"
          >
            <Plus className="size-3.5" /> {open ? "Close" : "New event"}
          </button>
        )
      }
    >
      {open && editable && (
        <Panel title="Create event" className="mb-4">
          <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label-mono">Event name</span>
              <input name="name" className={FIELD} maxLength={120} placeholder="Annual Gala 2026" />
              {errors["name"] && (
                <span className="font-mono text-[11px] text-destructive">{errors["name"]}</span>
              )}
            </label>
            <label className="sm:col-span-2">
              <span className="label-mono">Description</span>
              <textarea name="description" rows={2} maxLength={2000} className={FIELD} />
            </label>
            <label>
              <span className="label-mono">Category</span>
              <select name="category" className={FIELD} defaultValue="">
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label-mono">Venue</span>
              <select name="venue_id" className={FIELD} defaultValue="">
                <option value="">Unassigned</option>
                {(venues ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label-mono">Date</span>
              <input name="event_date" type="date" className={FIELD} />
              {errors["event_date"] && (
                <span className="font-mono text-[11px] text-destructive">
                  {errors["event_date"]}
                </span>
              )}
            </label>
            <label>
              <span className="label-mono">Capacity</span>
              <input name="capacity" type="number" min={0} className={FIELD} placeholder="500" />
            </label>
            <label>
              <span className="label-mono">Start time</span>
              <input name="start_time" type="time" className={FIELD} />
            </label>
            <label>
              <span className="label-mono">End time</span>
              <input name="end_time" type="time" className={FIELD} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={createEvent.isPending}
                className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
              >
                {createEvent.isPending ? "Creating…" : "Create event"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase transition-colors ${
              filter === s
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-subtle hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <Panel>
        {isLoading ? (
          <p className="font-mono text-xs text-subtle">Loading events…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No events in this view"
            body="Create an event or change the status filter to see more."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Event", "Date", "Venue", "Capacity", "Status", ""].map((h) => (
                    <th key={h} className="label-mono px-2 pb-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-3">
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: e.id }}
                        className="font-display text-sm text-foreground hover:text-primary"
                      >
                        {e.name}
                      </Link>
                      <p className="font-mono text-[10px] text-subtle">{e.category ?? "—"}</p>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                      {formatDate(e.event_date)}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                      {(e.venues as { name: string } | null)?.name ?? "—"}
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                      {e.capacity ?? "—"}
                    </td>
                    <td className="px-2 py-3">
                      {editable ? (
                        <select
                          value={e.status}
                          onChange={(ev) =>
                            updateStatus.mutate({
                              id: e.id,
                              status: ev.target.value as EventStatus,
                            })
                          }
                          className={`rounded-full border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS_TONE[e.status]}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-elevated text-foreground">
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${STATUS_TONE[e.status]}`}
                        >
                          {e.status}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {editable && (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            aria-label="Duplicate event"
                            onClick={() => duplicateEvent.mutate(e.id)}
                            className="grid size-7 place-items-center rounded text-subtle hover:bg-secondary hover:text-foreground"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Archive event"
                            onClick={() => updateStatus.mutate({ id: e.id, status: "archived" })}
                            className="grid size-7 place-items-center rounded text-subtle hover:bg-secondary hover:text-foreground"
                          >
                            <Archive className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete event"
                            onClick={() => {
                              if (confirm(`Delete "${e.name}" and all its data?`))
                                deleteEvent.mutate(e.id);
                            }}
                            className="grid size-7 place-items-center rounded text-subtle hover:bg-destructive/15 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
