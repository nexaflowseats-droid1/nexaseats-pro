// Server-only: receipt PDFs and receipt emails. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  canIssueReceipt,
  isRetryableEmailError,
  nextRetryAt,
  receiptAmounts,
  MAX_EMAIL_ATTEMPTS,
} from "@/lib/billing";

export async function loadSettings() {
  const { data } = await supabaseAdmin.from("app_settings").select("key, value");
  const s: Record<string, string | null> = {};
  for (const r of data ?? []) s[r.key] = r.value?.trim() || null;
  return s;
}

function money(n: number, cur: string) {
  return cur === "USD" ? `$${n.toFixed(2)}` : `${cur} ${Math.round(n).toLocaleString("en-US")}`;
}

function ascii(s: string | null | undefined) {
  return (s ?? "").replace(/[\u2014\u2013]/g, "-").replace(/[^\x20-\x7E]/g, "");
}

async function loadReceiptContext(receiptId: string) {
  const { data: r } = await supabaseAdmin
    .from("receipts")
    .select("*, orders(*), payments(*), organizations(name)")
    .eq("id", receiptId)
    .single();
  if (!r) throw new Error("Receipt not found");
  const { data: credit } = await supabaseAdmin
    .from("event_credits")
    .select("credits_total")
    .eq("order_id", r.order_id)
    .maybeSingle();
  const { data: refunds } = await supabaseAdmin.from("refunds").select("amount, currency, created_at").eq("order_id", r.order_id);
  return { r: r as any, credit, refunds: refunds ?? [] };
}

export async function buildReceiptPdf(receiptId: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { r, credit, refunds } = await loadReceiptContext(receiptId);
  const s = await loadSettings();
  const order = r.orders;
  const pay = r.payments;
  const pkg = order.package_snapshot as { name: string; tier: string; event_limit: number; guest_limit: number; savings: number };
  const amt = receiptAmounts(order);

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.08, 0.07);
  const muted = rgb(0.42, 0.42, 0.38);
  const amber = rgb(0.96, 0.69, 0.29);
  let y = 790;
  const text = (t: string, x: number, size = 10, f = font, color = ink) =>
    page.drawText(ascii(t), { x, y, size, font: f, color });

  // Header / brand
  page.drawRectangle({ x: 40, y: 772, width: 30, height: 30, color: ink });
  page.drawText("N", { x: 49, y: 780, size: 16, font: bold, color: amber });
  y = 788; text("Nexa Flow Seats", 80, 16, bold);
  y = 774; text("Smart Seating. Seamless Events. Powered by AI.", 80, 9, font, muted);
  y = 788; text("PAYMENT RECEIPT", 420, 12, bold);
  y = 774; text(r.status === "issued" ? "PAID" : r.status.replace("_", " ").toUpperCase(), 420, 9, bold, rgb(0.3, 0.55, 0.28));

  y = 752;
  const biz = [s["business_email"], s["business_website"], s["business_address"], s["business_phone"]].filter(Boolean) as string[];
  if (biz.length) { text(biz.join("  |  "), 40, 8, font, muted); y -= 14; }
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.6, color: muted });
  y -= 22;

  const rows = (pairs: [string, string][], x: number) => {
    for (const [k, v] of pairs) { text(k, x, 9, font, muted); text(v, x + 120, 9); y -= 15; }
  };
  const section = (t: string) => { y -= 6; text(t.toUpperCase(), 40, 9, bold, amber); y -= 16; };
  const dt = (v: string | null) => (v ? new Date(v).toUTCString().replace("GMT", "UTC") : "-");

  section("Receipt");
  rows([
    ["Receipt number", r.receipt_number],
    ["Issued", dt(r.issued_at)],
    ["Payment date", dt(pay.paid_at ?? order.paid_at)],
    ["Order ID", order.reference],
    ["Payment reference", pay.provider_reference ?? "-"],
  ], 40);

  section("Customer");
  rows([
    ["Name", order.buyer_name ?? "-"],
    ...(r.organizations?.name ? [["Organization", r.organizations.name] as [string, string]] : []),
    ["Billing email", order.buyer_email ?? "-"],
  ], 40);

  section("Package");
  rows([
    ["Package", pkg.name],
    ["Tier", (pkg.tier ?? "").toUpperCase()],
    ["Events purchased", String(pkg.event_limit)],
    ["Guest limit", `Up to ${Number(pkg.guest_limit).toLocaleString("en-US")} guests per event`],
    ["Package price", money(amt.usd, "USD")],
    ...(Number(pkg.savings) > 0 ? [["Savings", money(Number(pkg.savings), "USD")] as [string, string]] : []),
  ], 40);

  section("Payment");
  rows([
    ["Original amount", money(amt.usd, "USD")],
    ...(order.charge_currency !== "USD"
      ? [["Exchange rate", `1 USD = ${amt.rate.toLocaleString("en-US")} ${order.charge_currency}`] as [string, string]]
      : []),
    ["Total paid", money(amt.charged, order.charge_currency)],
    ["Method", pay.payment_method === "card" ? "Card" : "Mobile Money"],
    ["Transaction ref", pay.provider_transaction_id ?? pay.provider_transaction_uuid ?? "-"],
    ["Status", "Verified - successful"],
  ], 40);

  section("Event credits");
  rows([
    ["Credits purchased", String(pkg.event_limit)],
    ["Credits allocated", credit ? String(credit.credits_total) : "0"],
    ["Allocation", credit ? "Allocated" : "Pending"],
  ], 40);

  if (refunds.length) {
    section("Refunds");
    rows(refunds.map((f: any) => [dt(f.created_at), money(Number(f.amount), f.currency)] as [string, string]), 40);
  }

  y = 90;
  page.drawLine({ start: { x: 40, y: y + 14 }, end: { x: 555, y: y + 14 }, thickness: 0.6, color: muted });
  text("Thank you for choosing Nexa Flow Seats.", 40, 10, bold);
  y -= 14;
  const foot = [
    s["support_email"] ? `Support: ${s["support_email"]}` : null,
    s["refund_policy_url"] ? `Refund policy: ${s["refund_policy_url"]}` : null,
  ].filter(Boolean).join("   ");
  if (foot) { text(foot, 40, 8, font, muted); y -= 12; }
  text(`Verification: ${r.receipt_number}-${String(r.verification_code).slice(0, 10).toUpperCase()}`, 40, 8, font, muted);

  return doc.save();
}

/** Creates (once) the receipt + PDF for a paid order. Safe to call repeatedly. */
export async function ensureReceipt(orderId: string) {
  const { data: existing } = await supabaseAdmin.from("receipts").select("id, file_path").eq("order_id", orderId).maybeSingle();
  let receiptId = existing?.id;
  if (!receiptId) {
    const { data: order } = await supabaseAdmin.from("orders").select("id, status, user_id, organization_id").eq("id", orderId).single();
    const { data: pay } = await supabaseAdmin
      .from("payments").select("id, status").eq("order_id", orderId).eq("status", "successful")
      .order("paid_at", { ascending: false }).limit(1).maybeSingle();
    if (!order || !pay || !canIssueReceipt(order.status, pay.status)) return null;
    const { data: num, error: numErr } = await supabaseAdmin.rpc("next_receipt_number");
    if (numErr || !num) throw new Error(numErr?.message ?? "Could not number receipt");
    const { data: ins, error } = await supabaseAdmin
      .from("receipts")
      .insert({ receipt_number: num as string, order_id: orderId, payment_id: pay.id, user_id: order.user_id, organization_id: order.organization_id })
      .select("id").single();
    if (error) {
      // Unique order_id: another request created it first.
      const { data: again } = await supabaseAdmin.from("receipts").select("id").eq("order_id", orderId).single();
      receiptId = again?.id;
    } else receiptId = ins.id;
  }
  if (!receiptId) return null;
  if (!existing?.file_path) await renderAndStore(receiptId);
  return receiptId;
}

export async function renderAndStore(receiptId: string) {
  const { data: r } = await supabaseAdmin.from("receipts").select("receipt_number, user_id").eq("id", receiptId).single();
  if (!r) return;
  const bytes = await buildReceiptPdf(receiptId);
  const path = `${r.user_id}/${r.receipt_number}.pdf`;
  const { error } = await supabaseAdmin.storage.from("receipts").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("receipts").update({ file_path: path }).eq("id", receiptId);
}

export async function signedReceiptUrl(receiptId: string, download = false) {
  const { data: r } = await supabaseAdmin.from("receipts").select("file_path, receipt_number").eq("id", receiptId).single();
  let path = r?.file_path;
  if (!path) { await renderAndStore(receiptId); path = (await supabaseAdmin.from("receipts").select("file_path").eq("id", receiptId).single()).data?.file_path; }
  if (!path) throw new Error("Receipt file unavailable");
  const { data, error } = await supabaseAdmin.storage
    .from("receipts")
    .createSignedUrl(path, 300, download ? { download: `${r!.receipt_number}.pdf` } : undefined);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

function toBase64(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function emailHtml(p: { name: string | null; pkg: string; order: string; receipt: string; date: string; total: string; purchased: number; allocated: number; ref: string; link: string; support: string | null }) {
  const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#6b6b60;font-size:13px">${esc(k)}</td><td style="padding:6px 0;text-align:right;color:#15150f;font-size:13px">${esc(v)}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<table role="presentation" style="width:100%"><tr><td><span style="display:inline-block;background:#15150f;color:#f5b14a;font-weight:bold;padding:6px 10px;border-radius:6px">N</span>
<strong style="font-size:16px;color:#15150f;margin-left:8px">Nexa Flow Seats</strong></td></tr></table>
<h1 style="font-size:20px;color:#15150f;margin:24px 0 8px">Thank you for your payment${p.name ? `, ${esc(p.name)}` : ""}</h1>
<p style="color:#4a4a42;font-size:14px;line-height:1.5">Your payment has been verified. Your PDF receipt is attached.</p>
<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0">
${row("Package", p.pkg)}${row("Order ID", p.order)}${row("Receipt number", p.receipt)}${row("Payment date", p.date)}${row("Total paid", p.total)}${row("Event credits purchased", String(p.purchased))}${row("Event credits allocated", String(p.allocated))}${row("Payment reference", p.ref)}
</table>
<a href="${esc(p.link)}" style="display:inline-block;background:#f5b14a;color:#15150f;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">View receipt in Billing</a>
${p.support ? `<p style="color:#6b6b60;font-size:12px;margin-top:24px">Questions? Contact ${esc(p.support)}</p>` : ""}
</div></body></html>`;
}

/** Sends (or re-sends) one receipt email row. Never touches orders, payments or credits. */
export async function deliverEmail(emailId: string, appUrl: string) {
  const { data: e } = await supabaseAdmin.from("receipt_emails").select("*").eq("id", emailId).single();
  if (!e || e.status === "sent" || e.status === "delivered") return e?.status ?? "missing";
  if (e.attempt_count >= MAX_EMAIL_ATTEMPTS) return "failed";

  const attempt = e.attempt_count + 1;
  await supabaseAdmin.from("receipt_emails").update({ status: "sending", attempt_count: attempt, last_attempt_at: new Date().toISOString() }).eq("id", emailId);

  const fail = async (reason: string, status: number | null) => {
    const retry = isRetryableEmailError(status) ? nextRetryAt(attempt) : null;
    await supabaseAdmin.from("receipt_emails").update({ status: "failed", failure_reason: reason.slice(0, 500), next_retry_at: retry }).eq("id", emailId);
    return "failed";
  };

  const key = process.env["RESEND_API_KEY"];
  const s = await loadSettings();
  const from = s["receipt_sender"];
  if (!key) return fail("Email sending is not configured (missing email provider key).", 0);
  if (!from) return fail("Receipt sender address is not configured in admin settings.", 0);

  const { r, credit } = await loadReceiptContext(e.receipt_id);
  const order = r.orders;
  const pkg = order.package_snapshot as { name: string; event_limit: number };
  const bytes = await buildReceiptPdf(e.receipt_id);
  const subject = `Your Nexa Flow Seats Payment Receipt — ${r.receipt_number}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `receipt-${e.id}`,
      },
      body: JSON.stringify({
        from,
        to: [e.recipient],
        subject,
        ...(s["support_email"] ? { reply_to: s["support_email"] } : {}),
        html: emailHtml({
          name: order.buyer_name,
          pkg: pkg.name,
          order: order.reference,
          receipt: r.receipt_number,
          date: new Date(r.payments.paid_at ?? order.paid_at ?? r.issued_at).toUTCString(),
          total: money(Number(order.amount_charged), order.charge_currency),
          purchased: pkg.event_limit,
          allocated: credit?.credits_total ?? 0,
          ref: r.payments.provider_reference ?? "-",
          link: `${appUrl}/billing`,
          support: s["support_email"] ?? null,
        }),
        attachments: [{ filename: `${r.receipt_number}.pdf`, content: toBase64(bytes) }],
      }),
    });
    const body = await res.text();
    if (!res.ok) return fail(`Email provider rejected the request (${res.status}): ${body.slice(0, 300)}`, res.status);
    let id: string | null = null;
    try { id = JSON.parse(body)?.id ?? null; } catch { /* ignore */ }
    await supabaseAdmin.from("receipt_emails").update({ status: "sent", provider_message_id: id, failure_reason: null, next_retry_at: null }).eq("id", emailId);
    return "sent";
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Network error", null);
  }
}

/** Initial automatic receipt email — at most one per receipt (unique index). */
export async function queueInitialEmail(receiptId: string, appUrl: string) {
  const { data: r } = await supabaseAdmin.from("receipts").select("id, order_id, orders(buyer_email)").eq("id", receiptId).single();
  const to = (r as any)?.orders?.buyer_email as string | null;
  if (!r || !to) return null;
  const { data: row, error } = await supabaseAdmin
    .from("receipt_emails").insert({ receipt_id: receiptId, order_id: r.order_id, kind: "initial", recipient: to }).select("id").single();
  if (error) return null; // already queued by an earlier webhook — no duplicate
  return deliverEmail(row.id, appUrl);
}

/** Called after a payment is verified successful. Isolated from financial records. */
export async function afterPaymentSettled(orderId: string, appUrl: string | null) {
  try {
    const receiptId = await ensureReceipt(orderId);
    if (receiptId) await queueInitialEmail(receiptId, appUrl ?? process.env["APP_URL"] ?? "https://nexaseats-pro.lovable.app");
  } catch (err) {
    console.error("[receipts] post-payment processing failed", err);
  }
}
