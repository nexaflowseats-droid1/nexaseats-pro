import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SEATING_STRATEGIES = [
  { id: "social", label: "Best Social Seating" },
  { id: "networking", label: "Best Networking" },
  { id: "family", label: "Family-Friendly" },
  { id: "vip", label: "VIP-Focused" },
  { id: "compatibility", label: "Maximum Compatibility" },
] as const;

export type SeatingStrategy = (typeof SEATING_STRATEGIES)[number]["id"];

export type SeatingPlan = {
  summary: string;
  score: number;
  tables: {
    tableId: string;
    tableName: string;
    compatibility: number;
    rationale: string;
    emptySeats: number;
    guests: { guestId: string; name: string; vip: boolean }[];
  }[];
  conflicts: string[];
  recommendations: string[];
  assignments: { guestId: string; tableId: string }[];
};

const inputSchema = z.object({
  eventId: z.string().uuid(),
  strategy: z.enum(["social", "networking", "family", "vip", "compatibility"]),
  instruction: z.string().max(400).optional(),
});

const modelSchema = z.object({
  summary: z.string(),
  score: z.number().min(0).max(100),
  conflicts: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  tables: z
    .array(
      z.object({
        tableId: z.string(),
        compatibility: z.number().min(0).max(100),
        rationale: z.string(),
        guestIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export const planSeating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const [{ data: event }, { data: guests }, { data: tables }, { data: relationships }] =
      await Promise.all([
        supabase.from("events").select("name, category, event_date").eq("id", data.eventId).maybeSingle(),
        supabase
          .from("guests")
          .select(
            "id, first_name, last_name, company, job_title, vip_status, rsvp_status, dietary_requirements, accessibility_requirements, notes, group_id, guest_groups(name, type)",
          )
          .eq("event_id", data.eventId),
        supabase.from("event_tables").select("id, name, capacity, table_type").eq("event_id", data.eventId),
        supabase.from("guest_relationships").select("guest_id, related_guest_id, relationship_type, seating_preference"),
      ]);

    if (!event) throw new Error("Event not found");
    if (!tables || tables.length === 0) throw new Error("Add tables before generating a seating plan");
    const guestList = (guests ?? []).filter((g) => g.rsvp_status !== "declined");
    if (guestList.length === 0) throw new Error("No guests available to seat");

    const guestIds = new Set(guestList.map((g) => g.id));
    const rels = (relationships ?? []).filter(
      (r) => guestIds.has(r.guest_id) && guestIds.has(r.related_guest_id),
    );

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project");

    const payload = {
      event: { name: event.name, category: event.category, date: event.event_date },
      strategy: data.strategy,
      instruction: data.instruction ?? null,
      tables: tables.map((t) => ({ id: t.id, name: t.name, capacity: t.capacity, shape: t.table_type })),
      guests: guestList.map((g) => ({
        id: g.id,
        name: `${g.first_name} ${g.last_name}`,
        company: g.company,
        title: g.job_title,
        vip: g.vip_status,
        rsvp: g.rsvp_status,
        group: (g.guest_groups as { name: string; type: string } | null)?.name ?? null,
        groupType: (g.guest_groups as { name: string; type: string } | null)?.type ?? null,
        dietary: g.dietary_requirements,
        accessibility: g.accessibility_requirements,
        notes: g.notes,
      })),
      relationships: rels.map((r) => ({
        a: r.guest_id,
        b: r.related_guest_id,
        type: r.relationship_type,
        preference: r.seating_preference,
      })),
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an expert event seating planner. Assign every guest to a table without exceeding capacity. Honour must_sit_together and never_together relationships, keep groups/families together, place VIPs at prominent tables, respect accessibility needs, and balance the strategy requested. Use only the provided table ids and guest ids. Respond with the seating_plan tool.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "seating_plan",
              description: "Return the optimised seating plan.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  score: { type: "number" },
                  conflicts: { type: "array", items: { type: "string" } },
                  recommendations: { type: "array", items: { type: "string" } },
                  tables: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tableId: { type: "string" },
                        compatibility: { type: "number" },
                        rationale: { type: "string" },
                        guestIds: { type: "array", items: { type: "string" } },
                      },
                      required: ["tableId", "compatibility", "rationale", "guestIds"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "score", "conflicts", "recommendations", "tables"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "seating_plan" } },
      }),
    });

    if (response.status === 429) throw new Error("AI rate limit reached — try again in a moment");
    if (response.status === 402) throw new Error("AI credits exhausted for this workspace");
    if (!response.ok) {
      console.error("AI gateway error", response.status, await response.text());
      throw new Error("The seating assistant is unavailable right now");
    }

    const body = (await response.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const raw = body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!raw) throw new Error("The seating assistant returned no plan");
    const parsed = modelSchema.parse(JSON.parse(raw));

    const tableById = new Map(tables.map((t) => [t.id, t]));
    const guestById = new Map(guestList.map((g) => [g.id, g]));
    const used = new Set<string>();

    const planTables: SeatingPlan["tables"] = [];
    const assignments: SeatingPlan["assignments"] = [];

    for (const t of parsed.tables) {
      const table = tableById.get(t.tableId);
      if (!table) continue;
      const seated: SeatingPlan["tables"][number]["guests"] = [];
      for (const gid of t.guestIds) {
        const g = guestById.get(gid);
        if (!g || used.has(gid) || seated.length >= table.capacity) continue;
        used.add(gid);
        seated.push({ guestId: gid, name: `${g.first_name} ${g.last_name}`, vip: g.vip_status });
        assignments.push({ guestId: gid, tableId: table.id });
      }
      planTables.push({
        tableId: table.id,
        tableName: table.name,
        compatibility: Math.round(t.compatibility),
        rationale: t.rationale,
        emptySeats: Math.max(0, table.capacity - seated.length),
        guests: seated,
      });
    }

    const unplaced = guestList.filter((g) => !used.has(g.id)).map((g) => `${g.first_name} ${g.last_name}`);
    const conflicts = [...parsed.conflicts];
    if (unplaced.length > 0) {
      conflicts.push(`${unplaced.length} guest(s) could not be seated: ${unplaced.slice(0, 6).join(", ")}`);
    }

    const plan: SeatingPlan = {
      summary: parsed.summary,
      score: Math.round(parsed.score),
      tables: planTables,
      conflicts,
      recommendations: parsed.recommendations,
      assignments,
    };
    return plan;
  });

export const applySeatingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        eventId: z.string().uuid(),
        assignments: z.array(z.object({ guestId: z.string().uuid(), tableId: z.string().uuid() })).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { error: clearError } = await supabase
      .from("seating_assignments")
      .delete()
      .eq("event_id", data.eventId);
    if (clearError) throw new Error(clearError.message);

    const { error } = await supabase.from("seating_assignments").insert(
      data.assignments.map((a) => ({
        event_id: data.eventId,
        guest_id: a.guestId,
        table_id: a.tableId,
      })),
    );
    if (error) throw new Error(error.message);
    return { seated: data.assignments.length };
  });
