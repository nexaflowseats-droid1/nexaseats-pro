import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { Panel } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, ScheduleItem } from "@/lib/invitation.functions";

const FIELD =
  "w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/60";

/** Organizer controls for the guest-facing experience: kiosk, schedule, menu and photo moderation. */
export function EventExperiencePanel({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { data: ev } = useQuery({
    queryKey: ["event-experience", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("kiosk_enabled, schedule, menu")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  useEffect(() => {
    if (!ev) return;
    setSchedule(Array.isArray(ev.schedule) ? (ev.schedule as ScheduleItem[]) : []);
    setMenu(Array.isArray(ev.menu) ? (ev.menu as MenuItem[]) : []);
  }, [ev]);

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("events").update(patch as never).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["event-experience", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: photos } = useQuery({
    queryKey: ["guest-photos", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("guest_photos")
        .select("id, storage_path, caption, approved")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      const out: { id: string; url: string; caption: string | null; approved: boolean }[] = [];
      for (const p of data ?? []) {
        const { data: s } = await supabase.storage.from("event-images").createSignedUrl(p.storage_path, 3600);
        if (s) out.push({ id: p.id, url: s.signedUrl, caption: p.caption, approved: p.approved });
      }
      return out;
    },
  });
  const moderate = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = approve
        ? await supabase.from("guest_photos").update({ approved: true }).eq("id", id)
        : await supabase.from("guest_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guest-photos", eventId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const kioskUrl = `${origin}/kiosk/${eventId}`;

  return (
    <div className="space-y-4">
      <Panel title="Find-my-seat kiosk">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={!!ev?.kiosk_enabled}
              onChange={(e) => save.mutate({ kiosk_enabled: e.target.checked })}
            />
            Let arriving guests look up their table without signing in
          </label>
          <p className="text-xs text-muted-foreground">
            Guests only see first names with a last initial, and their table. Turn it off after the event.
          </p>
          {ev?.kiosk_enabled && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-elevated px-2 py-1 text-xs text-foreground">{kioskUrl}</code>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(kioskUrl).then(() => toast.success("Link copied"))}>
                Copy link
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={`/kiosk/${eventId}`} target="_blank" rel="noopener">
                  <ExternalLink className="size-4" /> Open kiosk
                </a>
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Event schedule">
        <div className="space-y-2">
          {schedule.map((s, i) => (
            <div key={i} className="grid grid-cols-[90px_1fr_1fr_auto] gap-2">
              <input className={FIELD} type="time" value={s.time} aria-label="Time"
                onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <input className={FIELD} placeholder="e.g. Dinner served" value={s.title} maxLength={80} aria-label="Title"
                onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <input className={FIELD} placeholder="Details (optional)" value={s.description ?? ""} maxLength={160} aria-label="Details"
                onChange={(e) => setSchedule(schedule.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <button type="button" aria-label="Remove" onClick={() => setSchedule(schedule.filter((_, j) => j !== i))} className="text-subtle hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSchedule([...schedule, { time: "18:00", title: "" }])}>
              <Plus className="size-4" /> Add item
            </Button>
            <Button size="sm" onClick={() => save.mutate({ schedule: schedule.filter((s) => s.title.trim()).sort((a, b) => a.time.localeCompare(b.time)) })}>
              Save schedule
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Menu">
        <div className="space-y-2">
          {menu.map((m, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_1fr_120px_auto] gap-2">
              <input className={FIELD} placeholder="Course" value={m.course} maxLength={40} aria-label="Course"
                onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, course: e.target.value } : x)))} />
              <input className={FIELD} placeholder="Dish" value={m.name} maxLength={80} aria-label="Dish"
                onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className={FIELD} placeholder="Description" value={m.description ?? ""} maxLength={160} aria-label="Description"
                onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input className={FIELD} placeholder="V, GF, nuts…" value={m.tags ?? ""} maxLength={40} aria-label="Dietary tags"
                onChange={(e) => setMenu(menu.map((x, j) => (j === i ? { ...x, tags: e.target.value } : x)))} />
              <button type="button" aria-label="Remove" onClick={() => setMenu(menu.filter((_, j) => j !== i))} className="text-subtle hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMenu([...menu, { course: "Main", name: "" }])}>
              <Plus className="size-4" /> Add dish
            </Button>
            <Button size="sm" onClick={() => save.mutate({ menu: menu.filter((m) => m.name.trim()) })}>
              Save menu
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title={`Guest photos (${photos?.length ?? 0})`}>
        {!photos?.length ? (
          <p className="text-xs text-muted-foreground">Photos guests upload from their invitation appear here for approval.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-[10px] border border-border">
                <img src={p.url} alt={p.caption ?? "Guest photo"} className="aspect-square w-full object-cover" loading="lazy" />
                <div className="flex items-center justify-between p-2">
                  <span className="text-[11px] text-muted-foreground">{p.approved ? "Visible" : "Pending"}</span>
                  <div className="flex gap-1">
                    {!p.approved && (
                      <button type="button" aria-label="Approve" onClick={() => moderate.mutate({ id: p.id, approve: true })} className="text-accent">
                        <Check className="size-4" />
                      </button>
                    )}
                    <button type="button" aria-label="Delete" onClick={() => moderate.mutate({ id: p.id, approve: false })} className="text-destructive">
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
