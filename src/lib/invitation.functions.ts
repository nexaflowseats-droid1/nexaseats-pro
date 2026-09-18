import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(8).max(200) });

const rsvpSchema = z.object({
  token: z.string().min(8).max(200),
  rsvp_status: z.enum(["confirmed", "declined", "maybe"]),
  dietary_requirements: z.string().max(500).optional(),
  accessibility_requirements: z.string().max(500).optional(),
  plus_ones: z.number().int().min(0).max(10),
});

export type InvitationView = {
  guest: { first_name: string; last_name: string; email: string | null };
  rsvp_status: "pending" | "confirmed" | "declined" | "maybe";
  dietary_requirements: string | null;
  accessibility_requirements: string | null;
  plus_ones: number;
  event: {
    name: string;
    description: string | null;
    event_date: string | null;
    start_time: string | null;
    end_time: string | null;
    venue: string | null;
    address: string | null;
  };
  message: string | null;
  table: { name: string; table_number: number } | null;
};

async function load(token: string): Promise<InvitationView | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: inv } = await supabaseAdmin
    .from("invitations")
    .select("id, message, event_id, guest_id, status, opened_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv) return null;

  const [{ data: guest }, { data: event }] = await Promise.all([
    supabaseAdmin
      .from("guests")
      .select(
        "first_name, last_name, email, rsvp_status, dietary_requirements, accessibility_requirements, plus_ones",
      )
      .eq("id", inv.guest_id)
      .maybeSingle(),
    supabaseAdmin
      .from("events")
      .select("name, description, event_date, start_time, end_time, venues(name, address)")
      .eq("id", inv.event_id)
      .maybeSingle(),
  ]);
  if (!guest || !event) return null;

  const { data: assignment } = await supabaseAdmin
    .from("seating_assignments")
    .select("event_tables(name, table_number)")
    .eq("guest_id", inv.guest_id)
    .maybeSingle();

  const venue = (event as unknown as { venues: { name: string; address: string | null } | null })
    .venues;
  const tbl = (
    assignment as unknown as {
      event_tables: { name: string; table_number: number } | null
    } | null
  )?.event_tables;

  return {
    guest: { first_name: guest.first_name, last_name: guest.last_name, email: guest.email },
    rsvp_status: guest.rsvp_status,
    dietary_requirements: guest.dietary_requirements,
    accessibility_requirements: guest.accessibility_requirements,
    plus_ones: guest.plus_ones,
    event: {
      name: event.name,
      description: event.description,
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      venue: venue?.name ?? null,
      address: venue?.address ?? null,
    },
    message: inv.message,
    table: tbl ? { name: tbl.name, table_number: tbl.table_number } : null,
  };
}

export const getInvitation = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const view = await load(data.token);
    if (view) {
      await supabaseAdmin
        .from("invitations")
        .update({ opened_at: new Date().toISOString(), status: "opened" })
        .eq("token", data.token)
        .is("opened_at", null);
    }
    return view;
  });

export const submitRsvp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => rsvpSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("guest_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");

    const { error } = await supabaseAdmin
      .from("guests")
      .update({
        rsvp_status: data.rsvp_status,
        dietary_requirements: data.dietary_requirements || null,
        accessibility_requirements: data.accessibility_requirements || null,
        plus_ones: data.plus_ones,
      })
      .eq("id", inv.guest_id);
    if (error) throw new Error(error.message);

    if (data.rsvp_status === "confirmed") {
      await supabaseAdmin
        .from("invitations")
        .update({ status: "confirmed" })
        .eq("token", data.token);
    }

    return await load(data.token);
  });
