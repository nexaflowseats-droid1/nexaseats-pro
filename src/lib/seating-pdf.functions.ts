import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  eventId: z.string().uuid(),
  baseUrl: z.string().url().max(300),
});

type GuestLite = {
  id: string;
  first_name: string;
  last_name: string;
  vip_status: boolean;
  rsvp_status: string;
  dietary_requirements: string | null;
};

/**
 * Builds a printable seating plan PDF (one section per table, with guest names,
 * RSVP status and VIP badges) plus a check-in QR code, stores it in the
 * generated-pdfs bucket and records it in the PDF generation center.
 */
export const generateSeatingPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const QRCode = (await import("qrcode")).default;

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, event_date, start_time, capacity, organization_id, venues(name, address)")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) throw new Error("Event not found");

    const [{ data: tables }, { data: assignments }] = await Promise.all([
      supabase
        .from("event_tables")
        .select("id, name, capacity, table_number")
        .eq("event_id", data.eventId)
        .order("table_number"),
      supabase
        .from("seating_assignments")
        .select(
          "table_id, guests(id, first_name, last_name, vip_status, rsvp_status, dietary_requirements)",
        )
        .eq("event_id", data.eventId),
    ]);

    const byTable = new Map<string, GuestLite[]>();
    for (const row of assignments ?? []) {
      const guest = row.guests as unknown as GuestLite | null;
      if (!guest) continue;
      const list = byTable.get(row.table_id) ?? [];
      list.push(guest);
      byTable.set(row.table_id, list);
    }

    // Reusable check-in QR token for this event.
    let token: string | null = null;
    const { data: existing } = await supabase
      .from("qr_codes")
      .select("token")
      .eq("event_id", data.eventId)
      .eq("type", "event")
      .maybeSingle();
    if (existing) {
      token = existing.token;
    } else {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      await supabase
        .from("qr_codes")
        .insert({ event_id: data.eventId, type: "event", token });
    }
    const qrTarget = `${data.baseUrl.replace(/\/$/, "")}/check-in?event=${event.id}&code=${token}`;
    const qr = QRCode.create(qrTarget, { errorCorrectionLevel: "M" });

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.08, 0.08, 0.07);
    const muted = rgb(0.42, 0.42, 0.4);
    const amber = rgb(0.84, 0.6, 0.2);

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 48;
    let page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const nextPage = () => {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    };
    const ensure = (needed: number) => {
      if (y - needed < margin) nextPage();
    };

    const venue = (event.venues as { name?: string; address?: string } | null) ?? null;

    page.drawText("SEATING PLAN", { x: margin, y: y - 4, size: 10, font: bold, color: amber });
    y -= 24;
    page.drawText(event.name.slice(0, 60), { x: margin, y, size: 20, font: bold, color: ink });
    y -= 18;
    const metaLine = [
      event.event_date ?? "Date TBC",
      event.start_time ? String(event.start_time).slice(0, 5) : null,
      venue?.name ?? null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    page.drawText(metaLine, { x: margin, y, size: 10, font, color: muted });
    y -= 14;
    page.drawText(
      `${assignments?.length ?? 0} seated guests  ·  ${tables?.length ?? 0} tables  ·  capacity ${event.capacity}`,
      { x: margin, y, size: 10, font, color: muted },
    );

    // QR code, drawn module by module (top right).
    const qrSize = 96;
    const modules = qr.modules.size;
    const cell = qrSize / modules;
    const qrX = pageWidth - margin - qrSize;
    const qrY = pageHeight - margin - qrSize + 10;
    for (let r = 0; r < modules; r += 1) {
      for (let c = 0; c < modules; c += 1) {
        if (!qr.modules.get(r, c)) continue;
        page.drawRectangle({
          x: qrX + c * cell,
          y: qrY + (modules - 1 - r) * cell,
          width: cell,
          height: cell,
          color: ink,
        });
      }
    }
    page.drawText("Scan to check in", {
      x: qrX,
      y: qrY - 12,
      size: 8,
      font,
      color: muted,
    });

    y = Math.min(y - 28, qrY - 30);
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.8,
      color: rgb(0.85, 0.85, 0.83),
    });
    y -= 24;

    for (const table of tables ?? []) {
      const guests = (byTable.get(table.id) ?? []).sort((a, b) =>
        `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`),
      );
      ensure(40 + guests.length * 14);
      page.drawText(table.name, { x: margin, y, size: 13, font: bold, color: ink });
      page.drawText(`${guests.length}/${table.capacity} seats`, {
        x: pageWidth - margin - 70,
        y,
        size: 10,
        font,
        color: muted,
      });
      y -= 16;

      if (guests.length === 0) {
        page.drawText("No guests assigned", { x: margin + 12, y, size: 10, font, color: muted });
        y -= 22;
        continue;
      }

      for (const g of guests) {
        ensure(20);
        const name = `${g.first_name} ${g.last_name}`.slice(0, 44);
        page.drawText(`•  ${name}`, { x: margin + 12, y, size: 10, font, color: ink });
        page.drawText(g.rsvp_status.toUpperCase(), {
          x: margin + 240,
          y,
          size: 9,
          font,
          color: muted,
        });
        if (g.vip_status) {
          page.drawText("VIP", { x: margin + 320, y, size: 9, font: bold, color: amber });
        }
        if (g.dietary_requirements) {
          page.drawText(g.dietary_requirements.slice(0, 28), {
            x: margin + 356,
            y,
            size: 8,
            font,
            color: muted,
          });
        }
        y -= 14;
      }
      y -= 12;
    }

    const bytes = await pdf.save();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${event.organization_id}/${event.id}/seating-plan-${stamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("generated-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    const { data: record, error: recordError } = await supabase
      .from("pdf_generations")
      .insert({
        organization_id: event.organization_id,
        event_id: event.id,
        type: "seating-plan",
        file_url: path,
        created_by: context.userId,
      })
      .select("id")
      .maybeSingle();
    if (recordError) throw recordError;

    return { path, id: record?.id ?? null, tables: tables?.length ?? 0 };
  });
