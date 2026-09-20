import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileDown,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageEvents } from "@/lib/org-context";
import { useTables, useAssignments, useGuests, useRelationships } from "@/lib/queries";
import {
  planSeating,
  applySeatingPlan,
  SEATING_STRATEGIES,
  type SeatingStrategy,
  type SeatingPlan,
} from "@/lib/seating-ai.functions";
import { generateSeatingPdf } from "@/lib/seating-pdf.functions";

const QUICK_COMMANDS = [
  "Seat all family members together",
  "Move VIP guests closer to the stage",
  "Create the best networking arrangement",
  "Optimize the seating plan",
];

const CANVAS_W = 1240;
const CANVAS_H = 760;
const TABLE_SIZE = 132;

export const Route = createFileRoute("/_authenticated/seating")({
  head: () => ({
    meta: [
      { title: "Seating Designer — Nexa Flow Seats" },
      {
        name: "description",
        content: "Drag tables, seat guests and resolve conflicts on a live floor plan.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SeatingPage,
});

function SeatingPage() {
  const { role } = useOrg();
  const editable = canManageEvents(role);
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: tables } = useTables(eventId);
  const { data: assignments } = useAssignments(eventId);
  const { data: guests } = useGuests(eventId);
  const guestIds = useMemo(() => (guests ?? []).map((g) => g.id), [guests]);
  const { data: relationships } = useRelationships(eventId, guestIds);
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [dragOverTable, setDragOverTable] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { x: number; y: number }>>({});
  const dragState = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(
    null,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["event_tables", eventId] });
    queryClient.invalidateQueries({ queryKey: ["seating_assignments", eventId] });
  };

  const seatedIds = useMemo(
    () => new Set((assignments ?? []).map((a) => a.guest_id)),
    [assignments],
  );
  const unseated = (guests ?? []).filter((g) => !seatedIds.has(g.id));

  const tableOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments ?? []) map.set(a.guest_id, a.table_id);
    return map;
  }, [assignments]);

  const guestName = (id: string) => {
    const g = (guests ?? []).find((x) => x.id === id);
    return g ? `${g.first_name} ${g.last_name}` : "Guest";
  };

  const conflicts = useMemo(() => {
    const list: { id: string; kind: "capacity" | "apart" | "together"; message: string }[] = [];
    for (const t of tables ?? []) {
      const count = (assignments ?? []).filter((a) => a.table_id === t.id).length;
      if (count > t.capacity) {
        list.push({
          id: `cap-${t.id}`,
          kind: "capacity",
          message: `${t.name} is over capacity (${count}/${t.capacity})`,
        });
      }
    }
    for (const r of relationships ?? []) {
      const a = tableOf.get(r.guest_id);
      const b = tableOf.get(r.related_guest_id);
      if (!a || !b) continue;
      const names = `${guestName(r.guest_id)} and ${guestName(r.related_guest_id)}`;
      if (r.seating_preference === "must_apart" && a === b) {
        list.push({ id: `ap-${r.id}`, kind: "apart", message: `${names} must not sit together` });
      }
      if (r.seating_preference === "must_together" && a !== b) {
        list.push({ id: `tg-${r.id}`, kind: "together", message: `${names} must sit together` });
      }
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, assignments, relationships, tableOf, guests]);

  const addTable = useMutation({
    mutationFn: async () => {
      const n = (tables?.length ?? 0) + 1;
      const { error } = await supabase.from("event_tables").insert({
        event_id: eventId!,
        name: `Table ${n}`,
        table_number: n,
        capacity: 8,
        table_type: "round",
        position_x: 60 + ((n - 1) % 6) * 180,
        position_y: 60 + Math.floor((n - 1) / 6) * 180,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Table added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveTable = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      const { error } = await supabase
        .from("event_tables")
        .update({ position_x: x, position_y: y })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedTable(null);
      toast.success("Table removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: async ({ guestId, tableId }: { guestId: string; tableId: string }) => {
      const existing = (assignments ?? []).find((a) => a.guest_id === guestId);
      if (existing) {
        if (existing.table_id === tableId) return;
        const { error } = await supabase
          .from("seating_assignments")
          .update({ table_id: tableId })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("seating_assignments")
        .insert({ event_id: eventId!, guest_id: guestId, table_id: tableId });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seating_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const autoSeat = useMutation({
    mutationFn: async () => {
      if (!tables || tables.length === 0) throw new Error("Create tables first");
      const rows: { event_id: string; guest_id: string; table_id: string }[] = [];
      const capacityLeft = new Map(
        tables.map((t) => [
          t.id,
          t.capacity - (assignments ?? []).filter((a) => a.table_id === t.id).length,
        ]),
      );
      const queue = [...unseated].sort((a, b) => {
        if (a.vip_status !== b.vip_status) return a.vip_status ? -1 : 1;
        return (a.company ?? "zzz").localeCompare(b.company ?? "zzz");
      });
      for (const g of queue) {
        const table = tables.find((t) => (capacityLeft.get(t.id) ?? 0) > 0);
        if (!table) break;
        capacityLeft.set(table.id, (capacityLeft.get(table.id) ?? 0) - 1);
        rows.push({ event_id: eventId!, guest_id: g.id, table_id: table.id });
      }
      if (rows.length === 0) throw new Error("No available seats or no unseated guests");
      const { error } = await supabase.from("seating_assignments").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} guests seated automatically`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runPlan = useServerFn(planSeating);
  const runApply = useServerFn(applySeatingPlan);
  const runPdf = useServerFn(generateSeatingPdf);
  const [strategy, setStrategy] = useState<SeatingStrategy>("social");
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<SeatingPlan | null>(null);

  const generatePlan = useMutation({
    mutationFn: async () =>
      (await runPlan({
        data: {
          eventId: eventId!,
          strategy,
          ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
        },
      })) as SeatingPlan,
    onSuccess: (result) => {
      setPlan(result);
      toast.success("Seating plan ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyPlan = useMutation({
    mutationFn: async () =>
      await runApply({ data: { eventId: eventId!, assignments: plan!.assignments } }),
    onSuccess: (res) => {
      toast.success(`${res.seated} guests seated`);
      setPlan(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportPdf = useMutation({
    mutationFn: async () => {
      const res = await runPdf({
        data: { eventId: eventId!, baseUrl: window.location.origin },
      });
      const { data, error } = await supabase.storage
        .from("generated-pdfs")
        .createSignedUrl(res.path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
    onSuccess: (url) => {
      queryClient.invalidateQueries({ queryKey: ["pdf_generations"] });
      toast.success("Seating plan PDF saved to the PDF center");
      window.open(url, "_blank", "noopener");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pos = (t: { id: string; position_x: number; position_y: number }) =>
    drafts[t.id] ?? { x: Number(t.position_x), y: Number(t.position_y) };

  const onPointerDown = (
    e: React.PointerEvent,
    t: { id: string; position_x: number; position_y: number },
  ) => {
    if (!editable) return;
    const p = pos(t);
    dragState.current = { id: t.id, startX: e.clientX, startY: e.clientY, ox: p.x, oy: p.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    const x = Math.max(0, Math.min(CANVAS_W - TABLE_SIZE, st.ox + (e.clientX - st.startX) / zoom));
    const y = Math.max(0, Math.min(CANVAS_H - TABLE_SIZE, st.oy + (e.clientY - st.startY) / zoom));
    setDrafts((d) => ({ ...d, [st.id]: { x, y } }));
  };

  const onPointerUp = () => {
    const st = dragState.current;
    dragState.current = null;
    if (!st) return;
    const p = drafts[st.id];
    if (!p || (Math.abs(p.x - st.ox) < 2 && Math.abs(p.y - st.oy) < 2)) {
      setSelectedTable((cur) => (cur === st.id ? null : st.id));
      return;
    }
    moveTable.mutate({ id: st.id, x: Math.round(p.x), y: Math.round(p.y) });
  };

  return (
    <AppShell
      title="Seating Designer"
      subtitle="Live floor plan, drag-and-drop seating and AI recommendations"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <EventPicker events={events} eventId={eventId} onChange={setEventId} />
          {eventId && (
            <button
              type="button"
              onClick={() => exportPdf.mutate()}
              disabled={exportPdf.isPending}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-border px-3 py-1.5 font-mono text-[11px] text-foreground hover:border-primary/50 hover:text-primary disabled:opacity-60"
            >
              <FileDown className="size-3.5" />
              {exportPdf.isPending ? "Building…" : "Seating PDF"}
            </button>
          )}
          {editable && eventId && (
            <>
              <button
                type="button"
                onClick={() => autoSeat.mutate()}
                disabled={autoSeat.isPending}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-primary/40 px-3 py-1.5 font-mono text-[11px] text-primary hover:bg-primary/10 disabled:opacity-60"
              >
                <Sparkles className="size-3.5" /> Auto-seat
              </button>
              <button
                type="button"
                onClick={() => addTable.mutate()}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright"
              >
                <Plus className="size-3.5" /> Add table
              </button>
            </>
          )}
        </div>
      }
    >
      {!eventId ? (
        <EmptyState title="No event selected" body="Create an event to start designing seating." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Tables" value={tables?.length ?? 0} />
            <StatCard label="Seated" value={assignments?.length ?? 0} tone="accent" />
            <StatCard label="Unseated" value={unseated.length} tone="primary" />
            <StatCard label="Conflicts" value={conflicts.length} />
          </div>

          {editable && (
            <Panel title="AI seating intelligence">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as SeatingStrategy)}
                    aria-label="Seating strategy"
                    className="rounded-[8px] border border-border bg-elevated px-2.5 py-1.5 font-mono text-[11px] text-foreground"
                  >
                    {SEATING_STRATEGIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="e.g. Keep John and Peter apart"
                    maxLength={400}
                    aria-label="Extra seating instruction"
                    className="min-w-[220px] flex-1 rounded-[8px] border border-border bg-elevated px-2.5 py-1.5 font-mono text-[11px] text-foreground placeholder:text-subtle"
                  />
                  <button
                    type="button"
                    onClick={() => generatePlan.mutate()}
                    disabled={generatePlan.isPending}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
                  >
                    <Wand2 className="size-3.5" />
                    {generatePlan.isPending ? "Thinking…" : "Generate plan"}
                  </button>
                </div>

                <p className="font-mono text-[10px] text-subtle">
                  Uses this event&apos;s {guests?.length ?? 0} guests, {tables?.length ?? 0} tables
                  and saved guest relationships.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_COMMANDS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setInstruction(c)}
                      className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-subtle hover:border-primary/50 hover:text-primary"
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {plan && (
                  <div className="space-y-3 rounded-[10px] border border-border bg-elevated p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[11px] text-foreground">{plan.summary}</p>
                      <span className="font-mono text-[11px] text-accent">
                        Score {plan.score}/100
                      </span>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {plan.tables.map((t) => (
                        <div
                          key={t.tableId}
                          className="rounded-[8px] border border-border bg-surface p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-display text-xs text-foreground">
                              {t.tableName}
                            </span>
                            <span className="font-mono text-[10px] text-primary">
                              {t.compatibility}% fit
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[10px] text-subtle">{t.rationale}</p>
                          <p className="mt-1.5 font-mono text-[10px] text-foreground">
                            {t.guests.map((g) => `${g.name}${g.vip ? " ★" : ""}`).join(", ") ||
                              "No guests"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-subtle">
                            {t.emptySeats} empty seat(s)
                          </p>
                        </div>
                      ))}
                    </div>

                    {plan.conflicts.length > 0 && (
                      <ul className="space-y-1">
                        {plan.conflicts.map((c) => (
                          <li key={c} className="font-mono text-[10px] text-destructive">
                            ⚠ {c}
                          </li>
                        ))}
                      </ul>
                    )}
                    {plan.recommendations.length > 0 && (
                      <ul className="space-y-1">
                        {plan.recommendations.map((r) => (
                          <li key={r} className="font-mono text-[10px] text-subtle">
                            • {r}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => applyPlan.mutate()}
                        disabled={applyPlan.isPending}
                        className="rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
                      >
                        {applyPlan.isPending ? "Applying…" : "Apply plan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlan(null)}
                        className="rounded-[8px] border border-border px-3 py-1.5 font-mono text-[11px] text-subtle hover:text-foreground"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Panel
              title="Floor plan"
              action={
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                    className="rounded-[6px] border border-border p-1 text-subtle hover:text-primary"
                  >
                    <ZoomOut className="size-3.5" />
                  </button>
                  <span className="font-mono text-[10px] text-subtle">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                    className="rounded-[6px] border border-border p-1 text-subtle hover:text-primary"
                  >
                    <ZoomIn className="size-3.5" />
                  </button>
                </div>
              }
            >
              {(tables ?? []).length === 0 ? (
                <EmptyState title="No tables yet" body="Add your first table to start the layout." />
              ) : (
                <div className="grid-bg relative max-h-[620px] overflow-auto rounded-[10px] border border-border">
                  <div
                    className="relative"
                    style={{
                      width: CANVAS_W * zoom,
                      height: CANVAS_H * zoom,
                    }}
                  >
                    <div
                      className="absolute left-0 top-0 origin-top-left"
                      style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})` }}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                    >
                      {(tables ?? []).map((t) => {
                        const seated = (assignments ?? []).filter((a) => a.table_id === t.id);
                        const over = seated.length > t.capacity;
                        const full = seated.length >= t.capacity;
                        const active = selectedTable === t.id;
                        const p = pos(t);
                        const vip = seated.some(
                          (a) => (a.guests as { vip_status?: boolean } | null)?.vip_status,
                        );
                        return (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedTable(active ? null : t.id);
                              }
                            }}
                            onPointerDown={(e) => onPointerDown(e, t)}
                            onDragOver={(e) => {
                              if (!editable) return;
                              e.preventDefault();
                              setDragOverTable(t.id);
                            }}
                            onDragLeave={() => setDragOverTable((cur) => (cur === t.id ? null : cur))}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverTable(null);
                              const guestId = e.dataTransfer.getData("text/guest-id");
                              if (guestId) assign.mutate({ guestId, tableId: t.id });
                            }}
                            style={{
                              left: p.x,
                              top: p.y,
                              width: TABLE_SIZE,
                              height: TABLE_SIZE,
                            }}
                            className={`absolute grid touch-none select-none place-items-center rounded-full border text-center transition-colors ${
                              editable ? "cursor-grab active:cursor-grabbing" : ""
                            } ${
                              dragOverTable === t.id
                                ? "border-accent bg-accent/20"
                                : over
                                  ? "border-destructive bg-destructive/10"
                                  : active
                                    ? "border-primary bg-primary/15"
                                    : full
                                      ? "border-accent/50 bg-accent/10"
                                      : "border-border bg-elevated hover:border-primary/50"
                            }`}
                          >
                            <span className="pointer-events-none">
                              <span className="block font-display text-sm text-foreground">
                                {t.name}
                                {vip && <span className="text-primary"> ★</span>}
                              </span>
                              <span className="block font-mono text-[10px] text-subtle">
                                {seated.length}/{t.capacity}
                              </span>
                              <span className="mt-1 flex max-w-[110px] flex-wrap justify-center gap-0.5">
                                {Array.from({ length: t.capacity }).map((_, i) => (
                                  <span
                                    key={i}
                                    className={`size-1.5 rounded-full ${
                                      i < seated.length ? "bg-primary" : "bg-border"
                                    }`}
                                  />
                                ))}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-2 font-mono text-[10px] text-subtle">
                Drag tables to reposition them. Drag a guest from the list onto a table to seat
                them.
              </p>
            </Panel>

            <div className="space-y-4">
              <Panel title={`Conflicts (${conflicts.length})`}>
                {conflicts.length === 0 ? (
                  <p className="font-mono text-xs text-accent">No seating conflicts.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {conflicts.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-1.5 rounded-[8px] border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 font-mono text-[10px] text-destructive"
                      >
                        <AlertTriangle className="mt-px size-3 shrink-0" />
                        {c.message}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title={selectedTable ? "Table detail" : "Select a table"}>
                {!selectedTable ? (
                  <p className="font-mono text-xs text-subtle">
                    Choose a table on the floor plan to view and manage its guests.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <ul className="space-y-1.5">
                      {(assignments ?? [])
                        .filter((a) => a.table_id === selectedTable)
                        .map((a) => {
                          const g = a.guests as {
                            first_name: string;
                            last_name: string;
                            vip_status: boolean;
                            rsvp_status: string;
                          } | null;
                          return (
                            <li
                              key={a.id}
                              className="flex items-center justify-between rounded-[8px] border border-border bg-elevated px-2.5 py-1.5"
                            >
                              <span className="font-mono text-[11px] text-foreground">
                                {g ? `${g.first_name} ${g.last_name}` : "Guest"}
                                {g?.vip_status && <span className="text-primary"> ★</span>}
                                <span className="ml-1.5 text-[9px] text-subtle">
                                  {g?.rsvp_status}
                                </span>
                              </span>
                              {editable && (
                                <button
                                  type="button"
                                  aria-label="Remove from table"
                                  onClick={() => unassign.mutate(a.id)}
                                  className="text-subtle hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeTable.mutate(selectedTable)}
                        className="w-full rounded-[8px] border border-destructive/40 px-3 py-1.5 font-mono text-[11px] text-destructive hover:bg-destructive/10"
                      >
                        Delete table
                      </button>
                    )}
                  </div>
                )}
              </Panel>

              <Panel title={`Unseated guests (${unseated.length})`}>
                {unseated.length === 0 ? (
                  <p className="font-mono text-xs text-subtle">Everyone has a seat.</p>
                ) : (
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                    {unseated.map((g) => (
                      <li
                        key={g.id}
                        draggable={editable}
                        onDragStart={(e) => e.dataTransfer.setData("text/guest-id", g.id)}
                        className={`flex items-center justify-between rounded-[8px] border border-border px-2.5 py-1.5 ${
                          editable ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        <span className="font-mono text-[11px] text-foreground">
                          {g.first_name} {g.last_name}
                          {g.vip_status && <span className="text-primary"> ★</span>}
                        </span>
                        {editable && selectedTable && (
                          <button
                            type="button"
                            onClick={() =>
                              assign.mutate({ guestId: g.id, tableId: selectedTable })
                            }
                            className="font-mono text-[10px] text-primary hover:underline"
                          >
                            Seat
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
