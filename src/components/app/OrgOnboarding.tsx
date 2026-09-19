import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { useOrg } from "@/lib/org-context";
import { createOrganization } from "@/lib/organizations.functions";

/** Blocks the app until the signed-in user belongs to at least one organization. */
export function OrgGate({ children }: { children: ReactNode }) {
  const { memberships, loading } = useOrg();
  const queryClient = useQueryClient();
  const create = useServerFn(createOrganization);
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => await create({ data: { name: name.trim() } }),
    onSuccess: () => {
      toast.success("Organization created");
      queryClient.invalidateQueries({ queryKey: ["memberships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="font-mono text-xs text-subtle">Loading workspace…</p>
      </div>
    );
  }

  if (memberships.length > 0) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-[12px] border border-border bg-surface p-6">
        <Building2 className="size-5 text-primary" />
        <h1 className="mt-3 font-display text-lg text-foreground">Create your organization</h1>
        <p className="mt-1 font-mono text-[11px] text-subtle">
          Everything — events, guests, seating and documents — lives inside your organization.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) {
              toast.error("Enter an organization name");
              return;
            }
            mutation.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nexa Events Group"
            maxLength={80}
            aria-label="Organization name"
            className="w-full rounded-[8px] border border-border bg-elevated px-3 py-2 font-mono text-xs text-foreground placeholder:text-subtle"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-[8px] bg-primary px-3 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
          >
            {mutation.isPending ? "Creating…" : "Create organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
