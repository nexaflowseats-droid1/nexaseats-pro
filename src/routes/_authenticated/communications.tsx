import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { AppShell, Panel, EmptyState } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageEvents } from "@/lib/org-context";
import { useCommunications, formatDate } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/communications")({
  head: () => ({
    meta: [
      { title: "Communications — Nexa Flow Seats" },
      { name: "description", content: "Send announcements and reminders to your guest audiences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommunicationsPage,
});

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60";

const schema = z.object({
  title: z.string().trim().min(2, "Title is required").max(140),
  message: z.string().trim().min(2, "Message is required").max(2000),
  channel: z.enum(["email", "sms", "in-app"]),
  audience: z.enum(["all", "confirmed", "pending", "vip", "staff"]),
});

function CommunicationsPage() {
  const { role } = useOrg();
  const editable = canManageEvents(role);
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: messages } = useCommunications(eventId);
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const send = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("communications").insert({
        event_id: eventId!,
        created_by: userData.user?.id ?? null,
        title: values.title,
        message: values.message,
        channel: values.channel,
        audience: values.audience,
        status: "queued",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message queued");
      queryClient.invalidateQueries({ queryKey: ["communications", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = schema.safeParse(Object.fromEntries(new FormData(form).entries()));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    send.mutate(parsed.data);
    form.reset();
  }

  return (
    <AppShell
      title="Communications"
      subtitle="Guest announcements, reminders and updates"
      actions={<EventPicker events={events} eventId={eventId} onChange={setEventId} />}
    >
      {!eventId ? (
        <EmptyState title="No event selected" body="Pick an event to message its guests." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {editable && (
            <Panel title="Compose">
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <label className="block">
                  <span className="label-mono">Title</span>
                  <input name="title" maxLength={140} className={FIELD} />
                  {errors["title"] && (
                    <span className="font-mono text-[11px] text-destructive">{errors["title"]}</span>
                  )}
                </label>
                <label className="block">
                  <span className="label-mono">Message</span>
                  <textarea name="message" rows={5} maxLength={2000} className={FIELD} />
                  {errors["message"] && (
                    <span className="font-mono text-[11px] text-destructive">
                      {errors["message"]}
                    </span>
                  )}
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="label-mono">Channel</span>
                    <select name="channel" className={FIELD} defaultValue="email">
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="in-app">In-app</option>
                    </select>
                  </label>
                  <label>
                    <span className="label-mono">Audience</span>
                    <select name="audience" className={FIELD} defaultValue="all">
                      <option value="all">All guests</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending RSVP</option>
                      <option value="vip">VIPs</option>
                      <option value="staff">Event staff</option>
                    </select>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={send.isPending}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
                >
                  <Send className="size-3.5" /> {send.isPending ? "Queuing…" : "Queue message"}
                </button>
              </form>
            </Panel>
          )}

          <Panel title="Message history">
            {(messages ?? []).length === 0 ? (
              <EmptyState title="Nothing sent yet" body="Your announcements will be listed here." />
            ) : (
              <ul className="space-y-2">
                {(messages ?? []).map((m) => (
                  <li key={m.id} className="rounded-[10px] border border-border bg-elevated p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm text-foreground">{m.title}</p>
                      <span className="font-mono text-[10px] uppercase text-primary">
                        {m.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{m.message}</p>
                    <p className="mt-2 font-mono text-[10px] text-subtle">
                      {m.channel} · {m.audience} · {formatDate(m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
