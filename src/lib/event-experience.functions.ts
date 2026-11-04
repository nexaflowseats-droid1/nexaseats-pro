import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LayoutElement = {
  id: string;
  kind: "stage" | "dance" | "bar" | "dj" | "buffet" | "entrance" | "exit";
  x: number;
  y: number;
  w: number;
  h: number;
};

export type KioskTable = {
  id: string;
  name: string;
  table_number: number;
  x: number;
  y: number;
};

export type KioskView = {
  event: { id: string; name: string; event_date: string | null; start_time: string | null; venue: string | null };
  schedule: { time: string; title: string; description?: string }[];
  tables: KioskTable[];
  elements: LayoutElement[];
};

const eventIdSchema = z.object({ eventId: z.string().uuid() });

/** Public kiosk: only works when the organizer has switched the kiosk on for the event. */
export const getKiosk = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => eventIdSchema.parse(d))
  .handler(async ({ data }): Promise<KioskView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, start_time, schedule, layout_elements, kiosk_enabled, venues(name)")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev || !ev.kiosk_enabled) return null;
    const { data: tables } = await supabaseAdmin
      .from("event_tables")
      .select("id, name, table_number, position_x, position_y")
      .eq("event_id", data.eventId)
      .order("table_number");
    return {
      event: {
        id: ev.id,
        name: ev.name,
        event_date: ev.event_date,
        start_time: ev.start_time,
        venue: (ev.venues as unknown as { name: string } | null)?.name ?? null,
      },
      schedule: Array.isArray(ev.schedule) ? (ev.schedule as KioskView["schedule"]) : [],
      elements: Array.isArray(ev.layout_elements) ? (ev.layout_elements as LayoutElement[]) : [],
      tables: (tables ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        table_number: t.table_number,
        x: Number(t.position_x),
        y: Number(t.position_y),
      })),
    };
  });

const findSchema = z.object({ eventId: z.string().uuid(), query: z.string().trim().min(2).max(60) });

export type SeatMatch = { name: string; tableId: string | null; tableName: string | null; tableNumber: number | null };

/** Name search for the kiosk. Returns first name + last initial only, max 8 matches. */
export const findSeat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => findSchema.parse(d))
  .handler(async ({ data }): Promise<SeatMatch[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("kiosk_enabled")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!ev?.kiosk_enabled) return [];
    const q = data.query.replace(/[%_,()]/g, "");
    const parts = q.split(/\s+/);
    let query = supabaseAdmin
      .from("guests")
      .select("id, first_name, last_name")
      .eq("event_id", data.eventId)
      .neq("rsvp_status", "declined")
      .limit(8);
    query =
      parts.length > 1
        ? query.ilike("first_name", `${parts[0]}%`).ilike("last_name", `${parts.slice(1).join(" ")}%`)
        : query.or(`first_name.ilike.${q}%,last_name.ilike.${q}%`);
    const { data: guests } = await query;
    if (!guests?.length) return [];
    const { data: seats } = await supabaseAdmin
      .from("seating_assignments")
      .select("guest_id, event_tables(id, name, table_number)")
      .in("guest_id", guests.map((g) => g.id));
    return guests.map((g) => {
      const t = (seats ?? []).find((s) => s.guest_id === g.id)?.event_tables as unknown as
        | { id: string; name: string; table_number: number }
        | null
        | undefined;
      return {
        name: `${g.first_name} ${g.last_name.charAt(0)}.`,
        tableId: t?.id ?? null,
        tableName: t?.name ?? null,
        tableNumber: t?.table_number ?? null,
      };
    });
  });

const scanSchema = z.object({ eventId: z.string().uuid(), code: z.string().trim().min(4).max(500) });

export type ScanResult =
  | { ok: true; already: boolean; guest: { name: string; vip: boolean; dietary: string | null }; table: string | null }
  | { ok: false; reason: string };

/** Staff scanner: accepts an invitation link/QR (…/i/<token>) or a raw token and checks the guest in. */
export const checkInByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scanSchema.parse(d))
  .handler(async ({ data, context }): Promise<ScanResult> => {
    const { supabase, userId } = context;
    const m = /\/i\/([A-Za-z0-9_-]+)/.exec(data.code);
    const token = m ? m[1] : data.code;
    const { data: inv } = await supabase
      .from("invitations")
      .select("guest_id, event_id")
      .eq("token", token)
      .maybeSingle();
    if (!inv) return { ok: false, reason: "Code not recognised" };
    if (inv.event_id !== data.eventId) return { ok: false, reason: "This invitation is for a different event" };

    const [{ data: guest }, { data: seat }, { data: existing }] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name, last_name, vip_status, dietary_requirements")
        .eq("id", inv.guest_id)
        .maybeSingle(),
      supabase
        .from("seating_assignments")
        .select("event_tables(name, table_number)")
        .eq("guest_id", inv.guest_id)
        .maybeSingle(),
      supabase.from("check_ins").select("id").eq("guest_id", inv.guest_id).eq("event_id", inv.event_id).maybeSingle(),
    ]);
    if (!guest) return { ok: false, reason: "Guest not found" };
    if (!existing) {
      const { error } = await supabase.from("check_ins").insert({
        event_id: inv.event_id,
        guest_id: inv.guest_id,
        checked_in_by: userId,
        method: "qr",
      });
      if (error) return { ok: false, reason: error.message };
    }
    const t = seat?.event_tables as unknown as { name: string; table_number: number } | null;
    return {
      ok: true,
      already: !!existing,
      guest: {
        name: `${guest.first_name} ${guest.last_name}`,
        vip: guest.vip_status,
        dietary: guest.dietary_requirements,
      },
      table: t ? `${t.name} (#${t.table_number})` : null,
    };
  });

const badgeSchema = z.object({
  eventId: z.string().uuid(),
  kind: z.enum(["place-cards", "badges"]),
  baseUrl: z.string().url().max(300),
});

/** Printable place cards (4 per A4) or name badges with personal QR (6 per A4). Saved to the PDF center. */
export const generatePrintables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => badgeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const QRCode = (await import("qrcode")).default;

    const { data: event } = await supabase
      .from("events")
      .select("id, name, organization_id")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!event) throw new Error("Event not found");

    const { data: guests } = await supabase
      .from("guests")
      .select("id, first_name, last_name, company, vip_status, dietary_requirements")
      .eq("event_id", data.eventId)
      .neq("rsvp_status", "declined")
      .order("last_name");
    if (!guests?.length) throw new Error("No guests to print");

    const [{ data: seats }, { data: invites }] = await Promise.all([
      supabase.from("seating_assignments").select("guest_id, event_tables(name, table_number)").eq("event_id", data.eventId),
      supabase.from("invitations").select("guest_id, token").eq("event_id", data.eventId),
    ]);
    const tableOf = new Map<string, string>();
    for (const s of seats ?? []) {
      const t = s.event_tables as unknown as { name: string; table_number: number } | null;
      if (t) tableOf.set(s.guest_id, `${t.name}`);
    }

    // Badges need a personal invitation token for their QR; create any that are missing.
    const tokenOf = new Map((invites ?? []).map((i) => [i.guest_id, i.token]));
    if (data.kind === "badges") {
      const missing = guests.filter((g) => !tokenOf.has(g.id));
      if (missing.length) {
        const rows = missing.map((g) => {
          const b = new Uint8Array(18);
          crypto.getRandomValues(b);
          const token = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
          tokenOf.set(g.id, token);
          return { event_id: data.eventId, guest_id: g.id, token };
        });
        const { error } = await supabase.from("invitations").insert(rows);
        if (error) throw new Error(error.message);
      }
    }

    const pdf = await PDFDocument.create();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const W = 595;
    const H = 842;
    const ink = rgb(0.1, 0.1, 0.12);
    const muted = rgb(0.45, 0.45, 0.5);
    const accent = rgb(0.05, 0.55, 0.6);
    const center = (text: string, font: typeof bold, size: number, cx: number, y: number, color = ink) => {
      let s = size;
      while (font.widthOfTextAtHeight(text, s) > 240 && s > 8) s -= 1;
      const w = font.widthOfTextAtHeight(text, s);
      pdfPage.drawText(text, { x: cx - w / 2, y, size: s, font, color });
    };
    let pdfPage = pdf.addPage([W, H]);

    if (data.kind === "place-cards") {
      // 2 x 4 grid of tent cards; dashed fold line, name on the lower (front) half.
      const cw = W / 2;
      const ch = H / 4;
      guests.forEach((g, i) => {
        const slot = i % 8;
        if (i > 0 && slot === 0) pdfPage = pdf.addPage([W, H]);
        const col = slot % 2;
        const row = Math.floor(slot / 2);
        const x = col * cw;
        const y = H - (row + 1) * ch;
        pdfPage.drawRectangle({ x: x + 6, y: y + 6, width: cw - 12, height: ch - 12, borderColor: muted, borderWidth: 0.5 });
        pdfPage.drawLine({ start: { x: x + 6, y: y + ch / 2 }, end: { x: x + cw - 6, y: y + ch / 2 }, color: muted, thickness: 0.4, dashArray: [3, 3] });
        const cx = x + cw / 2;
        center(`${g.first_name} ${g.last_name}`, bold, 18, cx, y + ch / 2 - 40);
        center(tableOf.get(g.id) ?? "Table to be assigned", regular, 11, cx, y + ch / 2 - 58, accent);
        if (g.dietary_requirements) center(g.dietary_requirements.slice(0, 40), regular, 8, cx, y + 20, muted);
        center(event.name, regular, 8, cx, y + ch - 30, muted);
      });
    } else {
      // 2 x 3 grid of badges with a personal check-in QR.
      const cw = W / 2;
      const ch = H / 3;
      const base = data.baseUrl.replace(/\/$/, "");
      guests.forEach((g, i) => {
        const slot = i % 6;
        if (i > 0 && slot === 0) pdfPage = pdf.addPage([W, H]);
        const col = slot % 2;
        const row = Math.floor(slot / 2);
        const x = col * cw;
        const y = H - (row + 1) * ch;
        pdfPage.drawRectangle({ x: x + 8, y: y + 8, width: cw - 16, height: ch - 16, borderColor: muted, borderWidth: 0.6 });
        pdfPage.drawRectangle({ x: x + 8, y: y + ch - 40, width: cw - 16, height: 32, color: g.vip_status ? rgb(0.85, 0.55, 0.2) : accent });
        const cx = x + cw / 2;
        center(g.vip_status ? `VIP · ${event.name}` : event.name, bold, 11, cx, y + ch - 28, rgb(1, 1, 1));
        center(g.first_name, bold, 24, cx, y + ch - 78);
        center(g.last_name, regular, 14, cx, y + ch - 98);
        if (g.company) center(g.company, regular, 9, cx, y + ch - 114, muted);
        const qr = QRCode.create(`${base}/i/${tokenOf.get(g.id)}`, { errorCorrectionLevel: "M" });
        const size = 92;
        const n = qr.modules.size;
        const cell = size / n;
        const qx = cx - size / 2;
        const qy = y + 34;
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (qr.modules.get(r, c))
              pdfPage.drawRectangle({ x: qx + c * cell, y: qy + (n - 1 - r) * cell, width: cell, height: cell, color: ink });
        center(tableOf.get(g.id) ?? "", regular, 9, cx, y + 20, accent);
      });
    }

    const bytes = await pdf.save();
    const path = `${event.organization_id}/${event.id}/${data.kind}-${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("generated-pdfs")
      .upload(path, bytes, { contentType: "application/pdf" });
    if (upErr) throw new Error(upErr.message);
    await supabase.from("pdf_generations").insert({
      organization_id: event.organization_id,
      event_id: event.id,
      type: data.kind,
      file_url: path,
      created_by: userId,
    });
    return { path, count: guests.length };
  });
