import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, EmptyState, Panel, StatCard } from "@/components/app/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/pricing";
import { EMAIL_STATUS_LABEL } from "@/lib/billing";
import { getReceiptUrl, resendReceipt, retryReceiptEmail } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing — Nexa Flow Seats" },
      { name: "description", content: "Event credits, orders, receipts and payment history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

const btn = "rounded-[6px] border border-border px-2 py-1 font-mono text-[10px] text-foreground hover:bg-secondary disabled:opacity-50";

function BillingPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const [credits, orders] = await Promise.all([
        supabase.from("event_credits").select("*, packages(name)").order("created_at", { ascending: false }),
        supabase
          .from("orders")
          .select("id, reference, status, amount_charged, amount_usd, fx_rate, charge_currency, created_at, paid_at, package_snapshot, credits_granted, payments(payment_method, status, provider_reference), receipts(id, receipt_number, status, receipt_emails(id, kind, status, attempt_count, failure_reason, last_attempt_at)), event_credits(credits_total), refunds(amount, currency, created_at)")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (orders.error) throw orders.error;
      return { credits: credits.data ?? [], orders: (orders.data ?? []) as any[] };
    },
  });
  const urlFn = useServerFn(getReceiptUrl);
  const resend = useServerFn(resendReceipt);
  const retry = useServerFn(retryReceiptEmail);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    setBusy(null);
    qc.invalidateQueries({ queryKey: ["billing"] });
  };
  const openReceipt = (id: string, mode: "view" | "download" | "print") =>
    act(`${mode}-${id}`, async () => {
      const w = window.open("", "_blank");
      const { url } = await urlFn({ data: { receiptId: id, download: mode === "download" } });
      if (w) { w.location.href = url; if (mode === "print") setTimeout(() => { try { w.print(); } catch { /* cross-origin */ } }, 1500); }
      else window.location.href = url;
    });

  const now = Date.now();
  const active = (data?.credits ?? []).filter((c) => !c.expires_at || new Date(c.expires_at).getTime() > now);
  const remaining = active.reduce((s, c) => s + (c.credits_total - c.credits_used), 0);

  return (
    <AppShell title="Billing" subtitle="Event credits, orders and receipts">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Event credits left" value={String(remaining)} tone="primary" />
          <StatCard label="Active packages" value={String(active.length)} />
          <StatCard label="Orders" value={String(data?.orders.length ?? 0)} tone="accent" />
        </div>
        <Panel
          title="Event credits"
          actions={<Link to="/pricing" className="rounded-[8px] bg-primary px-3 py-1.5 font-display text-xs font-semibold text-primary-foreground">Buy package</Link>}
        >
          {active.length === 0 ? (
            <EmptyState title="No active packages" body="Buy a package to add event credits." />
          ) : (
            <ul className="divide-y divide-border font-mono text-xs">
              {active.map((c) => (
                <li key={c.id} className="flex justify-between py-2">
                  <span className="text-foreground">{(c as any).packages?.name}</span>
                  <span className="text-muted-foreground">
                    {c.credits_total - c.credits_used}/{c.credits_total} left · up to {c.guest_limit} guests
                    {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Orders & receipts">
          {isLoading ? (
            <p className="font-mono text-xs text-subtle">Loading orders…</p>
          ) : error ? (
            <p className="font-mono text-xs text-destructive">Couldn't load orders. Refresh to try again.</p>
          ) : (data?.orders.length ?? 0) === 0 ? (
            <p className="font-mono text-xs text-subtle">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-left">
                    {["Order", "Package", "Amount", "Method", "Status", "Credits", "Receipt", "Email", ""].map((h) => <th key={h} className="label-mono pb-2 pr-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data!.orders.map((o) => {
                    const pay = (o.payments ?? []).find((p: any) => p.status === "successful") ?? o.payments?.[0];
                    const receipt = Array.isArray(o.receipts) ? o.receipts[0] : o.receipts;
                    const emails = (receipt?.receipt_emails ?? []) as any[];
                    const last = [...emails].sort((a, b) => (b.last_attempt_at ?? "").localeCompare(a.last_attempt_at ?? ""))[0];
                    const failed = emails.find((e) => e.status === "failed");
                    const credit = Array.isArray(o.event_credits) ? o.event_credits[0] : o.event_credits;
                    const refunded = (o.refunds ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
                    return [
                      <tr key={o.id} className="border-t border-border align-top">
                        <td className="py-2 pr-3 text-foreground">{o.reference}<br /><span className="text-subtle">{new Date(o.created_at).toLocaleDateString()}</span></td>
                        <td className="py-2 pr-3 text-muted-foreground">{o.package_snapshot?.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatMoney(o.amount_charged, o.charge_currency)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{pay?.payment_method === "card" ? "Card" : "Mobile Money"}</td>
                        <td className={`py-2 pr-3 capitalize ${o.status === "paid" ? "text-accent" : "text-subtle"}`}>
                          {o.status}{refunded > 0 && <span className="block text-[10px] text-subtle">Refunded {formatMoney(refunded, o.charge_currency)}</span>}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{credit?.credits_total ?? 0}/{o.package_snapshot?.event_limit ?? 0}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{receipt ? receipt.receipt_number : o.status === "paid" ? "Generating…" : "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{receipt ? (last ? EMAIL_STATUS_LABEL[last.status] : "Pending") : "—"}</td>
                        <td className="space-x-1 whitespace-nowrap py-2">
                          <button type="button" className={btn} onClick={() => setOpen(open === o.id ? null : o.id)}>View order</button>
                          {receipt && (
                            <>
                              <button type="button" className={btn} disabled={!!busy} onClick={() => openReceipt(receipt.id, "view")}>View receipt</button>
                              <button type="button" className={btn} disabled={!!busy} onClick={() => openReceipt(receipt.id, "download")}>Download PDF</button>
                              <button type="button" className={btn} disabled={!!busy} onClick={() => openReceipt(receipt.id, "print")}>Print</button>
                              {failed ? (
                                <button type="button" className={btn} disabled={!!busy} onClick={() => act(`r-${failed.id}`, () => retry({ data: { emailId: failed.id } }), "Retry attempted")}>Retry email</button>
                              ) : (
                                <button type="button" className={btn} disabled={!!busy} onClick={() => act(`s-${receipt.id}`, () => resend({ data: { receiptId: receipt.id } }), "Resend requested")}>Resend</button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>,
                      open === o.id && (
                        <tr key={`${o.id}-d`} className="bg-elevated/50">
                          <td colSpan={9} className="space-y-1 p-3 text-[11px] text-muted-foreground">
                            <p>Original price: {formatMoney(o.amount_usd, "USD")} · Rate: 1 USD = {Number(o.fx_rate).toLocaleString()} {o.charge_currency} · Charged: {formatMoney(o.amount_charged, o.charge_currency)}</p>
                            <p>Payment reference: {pay?.provider_reference ?? "—"} · Paid: {o.paid_at ? new Date(o.paid_at).toLocaleString() : "—"}</p>
                            <p>Credits purchased: {o.package_snapshot?.event_limit} · Allocated: {credit?.credits_total ?? 0} ({o.credits_granted ? "allocated" : "not allocated"})</p>
                            {failed?.failure_reason && <p className="text-destructive">Last email failure: {failed.failure_reason}</p>}
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
