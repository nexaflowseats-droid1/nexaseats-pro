import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, canManageOrg, ROLE_LABEL } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexa Flow Seats" },
      { name: "description", content: "Manage your profile, organization details and branding." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary/60";

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(120),
  phone: z.string().trim().max(40).optional(),
});

const orgSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(120),
  brand_color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #f5b14a"),
});

function SettingsPage() {
  const { currentOrg, currentOrgId, role, refresh } = useOrg();
  const admin = canManageOrg(role);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      setEmail(data.user?.email ?? "");
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", uid)
        .maybeSingle();
      setFullName(profile?.full_name ?? "");
      setPhone(profile?.phone ?? "");
    })();
  }, []);

  const saveProfile = useMutation({
    mutationFn: async (values: z.infer<typeof profileSchema>) => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, phone: values.phone || null })
        .eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Profile saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOrg = useMutation({
    mutationFn: async (values: z.infer<typeof orgSchema>) => {
      const { error } = await supabase
        .from("organizations")
        .update({ name: values.name, brand_color: values.brand_color })
        .eq("id", currentOrgId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Organization updated");
      await refresh();
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function resetPassword() {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  }

  return (
    <AppShell title="Settings" subtitle="Profile, organization and branding">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Your profile">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = profileSchema.safeParse({ full_name: fullName, phone });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Check your details");
                return;
              }
              saveProfile.mutate(parsed.data);
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="label-mono">Email</span>
              <input value={email} readOnly className={`${FIELD} opacity-70`} />
            </label>
            <label className="block">
              <span className="label-mono">Full name</span>
              <input
                value={fullName}
                maxLength={120}
                onChange={(e) => setFullName(e.target.value)}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className="label-mono">Phone</span>
              <input
                value={phone}
                maxLength={40}
                onChange={(e) => setPhone(e.target.value)}
                className={FIELD}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saveProfile.isPending}
                className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-60"
              >
                Save profile
              </button>
              <button
                type="button"
                onClick={() => void resetPassword()}
                className="rounded-[8px] border border-border px-4 py-2 font-mono text-xs text-foreground hover:bg-secondary"
              >
                Send password reset
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Organization">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const parsed = orgSchema.safeParse({
                name: String(fd.get("name") ?? ""),
                brand_color: String(fd.get("brand_color") ?? ""),
              });
              if (!parsed.success) {
                toast.error(parsed.error.issues[0]?.message ?? "Check your details");
                return;
              }
              saveOrg.mutate(parsed.data);
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="label-mono">Name</span>
              <input
                name="name"
                maxLength={120}
                defaultValue={currentOrg?.organizations.name ?? ""}
                disabled={!admin}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className="label-mono">Brand colour</span>
              <input
                name="brand_color"
                defaultValue={currentOrg?.organizations.brand_color ?? "#f5b14a"}
                disabled={!admin}
                className={FIELD}
              />
            </label>
            <p className="font-mono text-[11px] text-subtle">
              Your role: {role ? ROLE_LABEL[role] : "—"}
            </p>
            <button
              type="submit"
              disabled={!admin || saveOrg.isPending}
              className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-50"
            >
              Save organization
            </button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
