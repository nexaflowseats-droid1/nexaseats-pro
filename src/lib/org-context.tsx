import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export type Membership = {
  organization_id: string;
  role: OrgRole;
  organizations: { id: string; name: string; slug: string; plan: string; logo_url: string | null };
};

type OrgContextValue = {
  memberships: Membership[];
  currentOrgId: string | null;
  currentOrg: Membership | null;
  setCurrentOrgId: (id: string) => void;
  role: OrgRole | null;
  loading: boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);
const STORAGE_KEY = "nexa.currentOrg";

export function useMembershipsQuery() {
  return useQuery({
    queryKey: ["memberships"],
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, slug, plan, logo_url)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((m) => m.organizations) as unknown as Membership[];
    },
  });
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useMembershipsQuery();
  const [currentOrgId, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const valid = stored && data.some((m) => m.organization_id === stored) ? stored : null;
    setCurrent(valid ?? data[0]!.organization_id);
  }, [data]);

  const value = useMemo<OrgContextValue>(() => {
    const memberships = data ?? [];
    const currentOrg = memberships.find((m) => m.organization_id === currentOrgId) ?? null;
    return {
      memberships,
      currentOrgId,
      currentOrg,
      role: currentOrg?.role ?? null,
      loading: isLoading,
      setCurrentOrgId: (id: string) => {
        setCurrent(id);
        window.localStorage.setItem(STORAGE_KEY, id);
      },
    };
  }, [data, currentOrgId, isLoading]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgProvider");
  return ctx;
}

/** Role helpers mirroring the database RLS model. */
export function canManageEvents(role: OrgRole | null) {
  return role === "owner" || role === "admin" || role === "manager";
}
export function canManageOrg(role: OrgRole | null) {
  return role === "owner" || role === "admin";
}
