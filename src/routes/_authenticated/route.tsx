import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { OrgProvider } from "@/lib/org-context";
import { OrgGate } from "@/components/app/OrgOnboarding";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <OrgProvider>
      <OrgGate>
        <Outlet />
      </OrgGate>
    </OrgProvider>
  ),
});
