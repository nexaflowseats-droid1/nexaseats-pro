import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageEvents } from "@/lib/org-context";
import { useGuests, RSVP_TONE, type RsvpStatus } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({
    meta: [
      { title: "Guests — Nexa Flow Seats" },
      { name: "description", content: "Manage guest lists, RSVPs, VIPs and requirements." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuestsPage,
});

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60";

const RSVPS: RsvpStatus[] = ["confirmed", "pending", "declined", "maybe"];

const guestSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(60),
  last_name: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  job_title: z.string().trim().max(120).optional(),
  dietary_requirements: z.string().trim().max(300).optional(),
  accessibility_requirements: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function GuestsPage() {
  const { role } = useOrg();
  const editable = canManageEvents(role);
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: guests, isLoading } = useGuests(eventId);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const PER_PAGE = 25;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["guests", eventId] });

  const addGuest = useMutation({
    mutationFn: async (values: z.infer<typeof guestSchema>) => {
      const { error } = await supabase.from("guests").insert({
        event_id: eventId!,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        company: values.company || null,
        job_title: values.job_title || null,
        dietary_requirements: values.dietary_requirements || null,
        accessibility_requirements: values.accessibility_requirements || null,
        notes: values.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guest added");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchGuest = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { rsvp_status?: RsvpStatus; vip_status?: boolean };
    }) => {
      const { error } = await supabase.from("guests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeGuest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("guests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Guest removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importGuests = useMutation({
    mutationFn: async (file: File) => {
      const rows = parseCsv(await file.text());
      const existing = new Set(
        (guests ?? []).map((g) => `${g.first_name}|${g.last_name}`.toLowerCase()),
      );
      const payload = rows
        .map((r) => ({
          event_id: eventId!,
          first_name: (r["first_name"] ?? r["first name"] ?? "").slice(0, 60),
          last_name: (r["last_name"] ?? r["last name"] ?? "").slice(0, 60),
          email: (r["email"] ?? "").slice(0, 255) || null,
          phone: (r["phone"] ?? "").slice(0, 40) || null,
          company: (r["company"] ?? "").slice(0, 120) || null,
        }))
        .filter(
          (r) =>
            r.first_name &&
            r.last_name &&
            !existing.has(`${r.first_name}|${r.last_name}`.toLowerCase()),
        );
      if (payload.length === 0) throw new Error("No new valid rows found in this file");
      const { error } = await supabase.from("guests").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} guests imported`);
      setImporting(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (guests ?? []).filter((g) => {
      const matchesQ =
        !q ||
        `${g.first_name} ${g.last_name} ${g.email ?? ""} ${g.company ?? ""}`
          .toLowerCase()
          .includes(q);
      const matchesR = rsvpFilter === "all" || g.rsvp_status === rsvpFilter;
      return matchesQ && matchesR;
    });
  }, [guests, search, rsvpFilter]);

  const pageRows = filtered.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget).entries());
    const parsed = guestSchema.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    addGuest.mutate(parsed.data);
  }

  return (
    <AppShell
      title="Guests"
      subtitle="RSVP tracking, VIPs, dietary and accessibility requirements"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <EventPicker events={events} eventId={eventId} onChange={setEventId} />
          {editable && eventId && (
            <>
              <button
                type="button"
                onClick={() => setImporting((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Upload className="size-3.5" /> Import CSV
              </button>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright"
              >
                <Plus className="size-3.5" /> Add guest
              </button>
            </>
          )}
        </div>
      }
    >
      {!eventId ? (
        <EmptyState title="No event selected" body="Create an event first, then manage its guests." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total guests" value={guests?.length ?? 0} />
            <StatCard
              label="Confirmed"
              value={(guests ?? []).filter((g) => g.rsvp_status === "confirmed").length}
              tone="accent"
            />
            <StatCard
              label="Pending"
              value={(guests ?? []).filter((g) => g.rsvp_status === "pending").length}
              tone="primary"
            />
            <StatCard label="VIPs" value={(guests ?? []).filter((g) => g.vip_status).length} />
          </div>

          {importing && editable && (
            <Panel title="Import guests from CSV">
              <p className="font-mono text-[11px] text-subtle">
                Expected headers: first_name, last_name, email, phone, company. Duplicate names are
                skipped automatically.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importGuests.mutate(f);
                }}
                className="mt-3 font-mono text-xs text-muted-foreground"
              />
            </Panel>
          )}

          {open && editable && (
            <Panel title="Add guest">
              <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["first_name", "First name"],
                    ["last_name", "Last name"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["company", "Organization"],
                    ["job_title", "Job title"],
                    ["dietary_requirements", "Dietary requirements"],
                    ["accessibility_requirements", "Accessibility requirements"],
                  ] as const
                ).map(([name, label]) => (
                  <label key={name}>
                    <span className="label-mono">{label}</span>
                    <input name={name} className={FIELD} maxLength={300} />
                    {errors[name] && (
                      <span className="font-mono text-[11px] text-destructive">{errors[name]}</span>
                    )}
                  </label>
                ))}
                <label className="sm:col-span-2">
                  <span className="label-mono">Notes</span>
                  <textarea name="notes" rows={2} maxLength={500} className={FIELD} />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={addGuest.isPending}
                    className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
                  >
                    {addGuest.isPending ? "Adding…" : "Add guest"}
                  </button>
                </div>
              </form>
            </Panel>
          )}

          <Panel>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search name, email, company…"
                className="w-64 rounded-[8px] border border-input bg-background px-3 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-primary/60"
              />
              {["all", ...RSVPS].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setRsvpFilter(s);
                    setPage(0);
                  }}
                  className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase ${
                    rsvpFilter === s
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-subtle hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {isLoading ? (
              <p className="font-mono text-xs text-subtle">Loading guests…</p>
            ) : filtered.length === 0 ? (
              <EmptyState title="No guests match" body="Adjust your search or add new guests." />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse">
                    <thead>
                      <tr className="border-b border-border text-left">
                        {["Guest", "Contact", "Organization", "RSVP", "VIP", ""].map((h) => (
                          <th key={h} className="label-mono px-2 pb-2">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((g) => (
                        <tr key={g.id} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-3">
                            <p className="font-display text-sm text-foreground">
                              {g.first_name} {g.last_name}
                            </p>
                            {g.dietary_requirements && (
                              <p className="font-mono text-[10px] text-subtle">
                                {g.dietary_requirements}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                            {g.email ?? "—"}
                            <br />
                            {g.phone ?? ""}
                          </td>
                          <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                            {g.company ?? "—"}
                          </td>
                          <td className="px-2 py-3">
                            {editable ? (
                              <select
                                value={g.rsvp_status}
                                onChange={(e) =>
                                  patchGuest.mutate({
                                    id: g.id,
                                    patch: { rsvp_status: e.target.value as RsvpStatus },
                                  })
                                }
                                className={`rounded-full border bg-transparent px-2 py-0.5 font-mono text-[10px] uppercase ${RSVP_TONE[g.rsvp_status]}`}
                              >
                                {RSVPS.map((s) => (
                                  <option key={s} value={s} className="bg-elevated text-foreground">
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${RSVP_TONE[g.rsvp_status]}`}
                              >
                                {g.rsvp_status}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={() =>
                                patchGuest.mutate({
                                  id: g.id,
                                  patch: { vip_status: !g.vip_status },
                                })
                              }
                              className={`font-mono text-sm ${g.vip_status ? "text-primary" : "text-subtle"}`}
                              aria-label="Toggle VIP"
                            >
                              ★
                            </button>
                          </td>
                          <td className="px-2 py-3 text-right">
                            {editable && (
                              <button
                                type="button"
                                aria-label="Delete guest"
                                onClick={() => removeGuest.mutate(g.id)}
                                className="grid size-7 place-items-center rounded text-subtle hover:bg-destructive/15 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-subtle">
                  <span>
                    {filtered.length} guests · page {page + 1}/{totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded border border-border px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded border border-border px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
