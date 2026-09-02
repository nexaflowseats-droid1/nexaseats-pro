import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Send, Sparkles } from "lucide-react";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { EventPicker, useActiveEvent } from "@/components/app/EventPicker";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageEvents } from "@/lib/org-context";
import { useGuests, useInvitations } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/invitations")({
  head: () => ({
    meta: [
      { title: "Invitations — Nexa Flow Seats" },
      { name: "description", content: "Generate secure invitation links and track delivery." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitationsPage,
});

function token() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function InvitationsPage() {
  const { role } = useOrg();
  const editable = canManageEvents(role);
  const { events, eventId, setEventId } = useActiveEvent();
  const { data: guests } = useGuests(eventId);
  const { data: invitations } = useInvitations(eventId);
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["invitations", eventId] });

  const invitedIds = useMemo(
    () => new Set((invitations ?? []).map((i) => i.guest_id)),
    [invitations],
  );
  const missing = (guests ?? []).filter((g) => !invitedIds.has(g.id));

  const generate = useMutation({
    mutationFn: async () => {
      if (missing.length === 0) throw new Error("Every guest already has an invitation");
      const rows = missing.map((g) => ({
        event_id: eventId!,
        guest_id: g.id,
        token: token(),
        status: "draft" as const,
      }));
      const { error } = await supabase.from("invitations").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} invitations generated`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as sent");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendAll = useMutation({
    mutationFn: async () => {
      const ids = (invitations ?? []).filter((i) => i.status === "draft").map((i) => i.id);
      if (ids.length === 0) throw new Error("No draft invitations to send");
      const { error } = await supabase
        .from("invitations")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} invitations sent`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyLink(t: string) {
    const url = `${window.location.origin}/i/${t}`;
    void navigator.clipboard.writeText(url);
    toast.success("Invitation link copied");
  }

  const sent = (invitations ?? []).filter((i) => i.status !== "draft").length;

  return (
    <AppShell
      title="Invitations"
      subtitle="Secure guest links, QR access and delivery tracking"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <EventPicker events={events} eventId={eventId} onChange={setEventId} />
          {editable && eventId && (
            <>
              <button
                type="button"
                onClick={() => generate.mutate()}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-primary/40 px-3 py-1.5 font-mono text-[11px] text-primary hover:bg-primary/10"
              >
                <Sparkles className="size-3.5" /> Generate missing
              </button>
              <button
                type="button"
                onClick={() => sendAll.mutate()}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground hover:bg-primary-bright"
              >
                <Send className="size-3.5" /> Send drafts
              </button>
            </>
          )}
        </div>
      }
    >
      {!eventId ? (
        <EmptyState title="No event selected" body="Choose an event to manage its invitations." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Invitations" value={invitations?.length ?? 0} />
            <StatCard label="Sent" value={sent} tone="accent" />
            <StatCard label="Missing" value={missing.length} tone="primary" />
            <StatCard
              label="Opened"
              value={(invitations ?? []).filter((i) => i.opened_at).length}
            />
          </div>

          <Panel title="Invitation register">
            {(invitations ?? []).length === 0 ? (
              <EmptyState
                title="No invitations yet"
                body="Generate invitations to create secure per-guest links."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Guest", "Email", "Status", "Sent", ""].map((h) => (
                        <th key={h} className="label-mono px-2 pb-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(invitations ?? []).map((i) => {
                      const g = i.guests as {
                        first_name: string;
                        last_name: string;
                        email: string | null;
                      } | null;
                      return (
                        <tr key={i.id} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-3 font-display text-sm text-foreground">
                            {g ? `${g.first_name} ${g.last_name}` : "Guest"}
                          </td>
                          <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                            {g?.email ?? "—"}
                          </td>
                          <td className="px-2 py-3 font-mono text-[10px] uppercase text-primary">
                            {i.status}
                          </td>
                          <td className="px-2 py-3 font-mono text-[11px] text-muted-foreground">
                            {i.sent_at ? new Date(i.sent_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => copyLink(i.token)}
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                              >
                                <Copy className="size-3" /> Link
                              </button>
                              {editable && i.status === "draft" && (
                                <button
                                  type="button"
                                  onClick={() => send.mutate(i.id)}
                                  className="rounded border border-primary/40 px-2 py-1 font-mono text-[10px] text-primary hover:bg-primary/10"
                                >
                                  Send
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
