import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
export type EventStatus = Database["public"]["Enums"]["event_status"];
export type RsvpStatus = Database["public"]["Enums"]["rsvp_status"];

export function useEvents(orgId: string | null) {
  return useQuery({
    queryKey: ["events", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, venues(name, address)")
        .eq("organization_id", orgId!)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useEvent(eventId: string | null) {
  return useQuery({
    queryKey: ["event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, venues(name, address, capacity)")
        .eq("id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useGuests(eventId: string | null) {
  return useQuery({
    queryKey: ["guests", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guests")
        .select("*, guest_groups(name, type)")
        .eq("event_id", eventId!)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useVenues(orgId: string | null) {
  return useQuery({
    queryKey: ["venues", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCheckIns(eventId: string | null) {
  return useQuery({
    queryKey: ["check_ins", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select("*, guests(first_name, last_name, vip_status)")
        .eq("event_id", eventId!)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTables(eventId: string | null) {
  return useQuery({
    queryKey: ["event_tables", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tables")
        .select("*, seats(id, seat_number)")
        .eq("event_id", eventId!)
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignments(eventId: string | null) {
  return useQuery({
    queryKey: ["seating_assignments", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seating_assignments")
        .select("*, guests(id, first_name, last_name, vip_status, rsvp_status)")
        .eq("event_id", eventId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useDocuments(orgId: string | null) {
  return useQuery({
    queryKey: ["documents", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, events(name)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvitations(eventId: string | null) {
  return useQuery({
    queryKey: ["invitations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("*, guests(first_name, last_name, email)")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCommunications(eventId: string | null) {
  return useQuery({
    queryKey: ["communications", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTeam(orgId: string | null) {
  return useQuery({
    queryKey: ["team", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, role, created_at, user_id, profiles(full_name, email, avatar_url)")
        .eq("organization_id", orgId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export const STATUS_TONE: Record<EventStatus, string> = {
  draft: "text-subtle border-border",
  published: "text-primary border-primary/40",
  upcoming: "text-primary border-primary/40",
  live: "text-accent border-accent/40",
  completed: "text-muted-foreground border-border",
  archived: "text-subtle border-border",
};

export const RSVP_TONE: Record<RsvpStatus, string> = {
  confirmed: "text-accent border-accent/40",
  pending: "text-primary border-primary/40",
  declined: "text-destructive border-destructive/40",
  maybe: "text-muted-foreground border-border",
};

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value: string | null) {
  if (!value) return "—";
  return value.slice(0, 5);
}

export function useRelationships(eventId: string | null, guestIds: string[]) {
  return useQuery({
    queryKey: ["guest_relationships", eventId, guestIds.length],
    enabled: !!eventId && guestIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_relationships")
        .select("*")
        .in("guest_id", guestIds);
      if (error) throw error;
      return data;
    },
  });
}

export function usePdfGenerations(orgId: string | null) {
  return useQuery({
    queryKey: ["pdf_generations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdf_generations")
        .select("*, events(name)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}
