import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/app/AppShell";
import {
  adminOverview,
  getReceiptUrl,
  recordRefund,
  resendReceipt,
  retryReceiptEmail,
  savePackageService,
  saveSettings,
} from "@/lib/billing.functions";
import { EMAIL_STATUS_LABEL, resolveServiceValue } from "@/lib/billing";
import { formatMoney } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Nexa Flow Seats" },
      { name: "description", content: "Business details, package service levels, receipts and email delivery." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const input =
  "w-full rounded-[8px] border border-border bg-elevated px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none";
const btn = "rounded-[8px] px-3 py-1.5 font-display text-xs font-semibold transition-colors disabled:opacity-50";

const BUSINESS: [string, string][] = [
  ["business_email", "Business email"],
  ["business_website", "Website"],
  ["business_address", "Business address"],
  ["business_phone", "Telephone"],
  ["support_email", "Support email"],
  ["refund_policy_url", "Refund policy link"],
  ["receipt_sender", "Receipt sender (Name <billing@yourdomain.com>)"],
  ["usd_ugx_rate", "USD → UGX rate"],
];
const PROPOSED: Record<string, string> = {
  setup_time_standard: "Within 24 hours",
  setup_time_extended: "Within 12 hours",
  support_standard: "Standard Support",
  support_extended: "Priority Support",
};

function AdminPage() {
  const qc = useQueryClient();
  const overview = useServerFn(adminOverview);
  const { data, error, isLoading } = useQuery({ queryKey: ["admin-overview"], queryFn: () => overview(), retry: false });
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setValues(data.settings); }, [data]);

  const save = useServerFn(saveSettings);
  const savePkg = useServerFn(savePackageService);
  const urlFn = useServerFn(getReceiptUrl);
  const resend = useServerFn(resendReceipt);
  const retry = useServerFn(retryReceiptEmail);
  const refund = useServerFn(recordRefund);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  const saveMut = useMutation({
    mutationFn: (keys: string[]) =>
      save({ data: { values: Object.fromEntries(keys.map((k) => [k, values[k] ?? ""])) as never } }),
    onSuccess: () => { toast.success("Saved"); refresh(); qc.invalidateQueries({ queryKey: ["pricing-packages"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <AppShell title="Admin"><p className="font-mono text-xs text-subtle">Loading…</p></AppShell>;
  if (error || !data)
    return (
      <AppShell title="Admin">
        <Panel title="Access denied"><p className="font-mono text-xs text-muted-foreground">{(error as Error)?.message ?? "Administrator access required."}</p></Panel>
      </AppShell>
    );

  const run = async (p: Promise<unknown>, ok: string) => {
    try { await p; toast.success(ok); } catch (e) { toast.error((e as Error).message); }
    refresh();
  };

  return (
    <AppShell title="Admin" subtitle="Platform billing configuration">
      <div className="space-y-4">
        <Panel title="Business details on receipts">
          <div className="grid gap-3 sm:grid-cols-2">
            {BUSINESS.map(([k, label]) => (
              <label key={k} className="space-y-1">
                <span className="label-mono">{label}</span>
                <input className={input} value={values[k] ?? ""} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate(BUSINESS.map(([k]) => k))} className={`${btn} mt-4 bg-primary text-primary-foreground hover:bg-primary-bright`}>
            Save business details
          </button>
        </Panel>

        <Panel title="Setup time & support — tier defaults">
          <p className="mb-3 font-mono text-[11px] text-subtle">
            Leave blank to hide on the pricing page. Suggestions are shown as placeholders only — they are not published until you save them.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(PROPOSED).map((k) => (
              <label key={k} className="space-y-1">
                <span className="label-mono">{k.replace(/_/g, " ")}</span>
                <input className={input} placeholder={`Proposed: ${PROPOSED[k]}`} value={values[k] ?? ""} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate(Object.keys(PROPOSED))} className={`${btn} mt-4 bg-primary text-primary-foreground hover:bg-primary-bright`}>
            Save tier defaults
          </button>
        </Panel>

        <Panel title="Per-package overrides">
          <div className="space-y-3">
            {data.packages.map((p) => (
              <PackageRow
                key={p.id}
                pkg={p}
                setupDefault={data.settings[`setup_time_${p.tier}`] ?? ""}
                supportDefault={data.settings[`support_${p.tier}`] ?? ""}
                onSave={(setupTime, supportLevel) => run(savePkg({ data: { packageId: p.id, setupTime, supportLevel } }), "Package saved")}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Receipts & email delivery">
          {data.receipts.length === 0 ? (
            <p className="font-mono text-xs text-subtle">No receipts yet. Receipts are created automatically when a payment is verified.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead><tr className="text-left">
                  {["Receipt", "Order / ref", "Customer", "Amount", "Status", "Email", "Actions"].map((h) => <th key={h} className="label-mono pb-2 pr-3">{h}</th>)}
                </tr></thead>
                <tbody>
                  {data.receipts.map((r) => {
                    const emails = (r.receipt_emails ?? []) as any[];
                    const last = [...emails].sort((a, b) => (b.last_attempt_at ?? "").localeCompare(a.last_attempt_at ?? ""))[0];
                    const failed = emails.find((e) => e.status === "failed");
                    return (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="py-2 pr-3 text-foreground">{r.receipt_number}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.orders?.reference}<br /><span className="text-subtle">{r.payments?.provider_reference}</span></td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.orders?.buyer_email}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatMoney(r.orders?.amount_charged ?? 0, r.orders?.charge_currency ?? "UGX")}</td>
                        <td className="py-2 pr-3 capitalize text-muted-foreground">{String(r.status).replace("_", " ")}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {last ? `${EMAIL_STATUS_LABEL[last.status]} (${last.attempt_count})` : "Not sent"}
                          {failed?.failure_reason && <p className="mt-1 max-w-xs text-[10px] text-destructive">{failed.failure_reason}</p>}
                        </td>
                        <td className="space-x-1 whitespace-nowrap py-2">
                          <button type="button" className={`${btn} border border-border text-foreground`} onClick={async () => { const { url } = await urlFn({ data: { receiptId: r.id, download: true } }); window.open(url, "_blank"); }}>PDF</button>
                          {failed && <button type="button" className={`${btn} border border-border text-foreground`} onClick={() => run(retry({ data: { emailId: failed.id } }), "Retry attempted")}>Retry</button>}
                          <button type="button" className={`${btn} border border-border text-foreground`} onClick={() => run(resend({ data: { receiptId: r.id } }), "Resend attempted")}>Resend</button>
                          <button type="button" className={`${btn} border border-border text-foreground`} onClick={() => {
                            const v = window.prompt(`Refund amount in ${r.orders?.charge_currency}`);
                            if (!v) return;
                            const reason = window.prompt("Reason (optional)") ?? undefined;
                            run(refund({ data: { receiptId: r.id, amount: Number(v), ...(reason ? { reason } : {}) } }), "Refund recorded");
                          }}>Refund</button>
                        </td>
                      </tr>
                    );
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

function PackageRow({ pkg, setupDefault, supportDefault, onSave }: {
  pkg: { id: string; name: string; tier: string; setup_time: string | null; support_level: string | null };
  setupDefault: string; supportDefault: string;
  onSave: (setup: string, support: string) => void;
}) {
  const [setup, setSetup] = useState(pkg.setup_time ?? "");
  const [support, setSupport] = useState(pkg.support_level ?? "");
  const s = resolveServiceValue(pkg.setup_time, setupDefault);
  const p = resolveServiceValue(pkg.support_level, supportDefault);
  const badge = (src: string) => <span className={`ml-1 rounded px-1.5 text-[10px] uppercase ${src === "override" ? "bg-primary/15 text-primary" : src === "inherited" ? "bg-accent/15 text-accent" : "bg-secondary text-subtle"}`}>{src}</span>;
  return (
    <div className="grid items-end gap-2 rounded-[8px] border border-border p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
      <div className="font-mono text-xs"><p className="text-foreground">{pkg.name}</p><p className="text-subtle uppercase">{pkg.tier}</p></div>
      <label className="space-y-1"><span className="label-mono">Setup{badge(s.source)}</span>
        <input className={input} placeholder={setupDefault ? `Inherits: ${setupDefault}` : "Blank"} value={setup} onChange={(e) => setSetup(e.target.value)} /></label>
      <label className="space-y-1"><span className="label-mono">Support{badge(p.source)}</span>
        <input className={input} placeholder={supportDefault ? `Inherits: ${supportDefault}` : "Blank"} value={support} onChange={(e) => setSupport(e.target.value)} /></label>
      <button type="button" onClick={() => onSave(setup, support)} className={`${btn} border border-border text-foreground hover:bg-secondary`}>Save</button>
    </div>
  );
}
