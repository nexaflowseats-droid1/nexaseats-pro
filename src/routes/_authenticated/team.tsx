import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, Panel, EmptyState, StatCard } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageOrg, ROLE_LABEL } from "@/lib/org-context";
import { useTeam, formatDate } from "@/lib/queries";
import type { Database } from "@/integrations/supabase/types";

type OrgRole = Database["public"]["Enums"]["org_role"];

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — Nexa Flow Seats" },
      { name: "description", content: "Manage teammates and their permissions in your workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

const ROLES: OrgRole[] = ["owner", "event_manager", "event_staff"];

function TeamPage() {
  const { currentOrgId, role } = useOrg();
  const admin = canManageOrg(role);
  const { data: team, isLoading } = useTeam(currentOrgId);
  const queryClient = useQueryClient();

  const changeRole = useMutation({
    mutationFn: async ({ id, newRole }: { id: string; newRole: OrgRole }) => {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["team", currentOrgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Team" subtitle="Roles and permissions across your organization">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Members" value={team?.length ?? 0} />
          <StatCard
            label="Managers"
            value={(team ?? []).filter((m) => m.role === "event_manager").length}
            tone="primary"
          />
          <StatCard
            label="Staff"
            value={(team ?? []).filter((m) => m.role === "event_staff").length}
            tone="accent"
          />
        </div>

        <Panel title="Members">
          {isLoading ? (
            <p className="font-mono text-xs text-subtle">Loading team…</p>
          ) : (team ?? []).length === 0 ? (
            <EmptyState title="No teammates yet" body="Invite colleagues to collaborate on events." />
          ) : (
            <ul className="divide-y divide-border/60">
              {(team ?? []).map((m) => {
                const p = m.profiles as unknown as {
                  full_name: string | null;
                  email: string | null;
                } | null;
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-display text-sm text-foreground">
                        {p?.full_name ?? p?.email ?? "Team member"}
                      </p>
                      <p className="font-mono text-[10px] text-subtle">
                        {p?.email ?? "—"} · joined {formatDate(m.created_at)}
                      </p>
                    </div>
                    {admin ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeRole.mutate({ id: m.id, newRole: e.target.value as OrgRole })
                        }
                        className="rounded-[8px] border border-input bg-background px-3 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-primary/60"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Invites">
          <p className="font-mono text-xs text-subtle">
            Teammates join by signing up with their work email; an owner then assigns their role
            here. Email-based invitations are coming next.
          </p>
        </Panel>
      </div>
    </AppShell>
  );
}
