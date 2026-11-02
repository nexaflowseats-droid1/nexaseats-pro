import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, CalendarDays, CreditCard, DollarSign, Mail, ShieldCheck, Users, UserCheck } from "lucide-react";
import { Panel } from "@/components/app/AppShell";
import { adminPlatform, setAdminRole, setOrgPlan } from "@/lib/admin.functions";
import { formatMoney } from "@/lib/pricing";

const TABS = ["Overview", "Revenue & orders", "Organizations", "Users", "Events", "Messages", "Billing settings"] as const;
type Tab = (typeof TABS)[number];
const PLANS = ["free", "professional", "business", "enterprise"] as const;

const th = "pb-2 pr-3 text-left text-[11px] font-medium text-subtle";
const td = "py-2 pr-3 text-xs text-muted-foreground";
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-subtle"><Icon className="size-4 text-primary" />{label}</div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-subtle">{hint}</p>}
    </div>
  );
}

function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const c = { ok: "bg-accent/15 text-accent", warn: "bg-primary/15 text-primary", bad: "bg-destructive/15 text-destructive", muted: "bg-secondary text-muted-foreground" }[tone];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${c}`}>{children}</span>;
}
const statusTone = (s: string) => (["paid", "succeeded", "successful", "completed", "live"].includes(s) ? "ok" : ["failed", "cancelled", "expired"].includes(s) ? "bad" : "warn");

export function AdminDashboard({ billing }: { billing: ReactNode }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const fetchFn = useServerFn(adminPlatform);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-platform"], queryFn: () => fetchFn(), retry: false });
  const roleFn = useServerFn(setAdminRole);
  const planFn = useServerFn(setOrgPlan);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-platform"] });
  const roleMut = useMutation({ mutationFn: (v: { userId: string; admin: boolean }) => roleFn({ data: v }), onSuccess: () => { toast.success("Role updated"); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const planMut = useMutation({ mutationFn: (v: { orgId: string; plan: (typeof PLANS)[number] }) => planFn({ data: v }), onSuccess: () => { toast.success("Plan updated"); refresh(); }, onError: (e: Error) => toast.error(e.message) });

  const m = useMemo(() => {
    if (!data) return null;
    const paid = data.orders.filter((o) => o.status === "paid");
    const revenue = paid.reduce((s, o) => s + Number(o.amount_charged || 0), 0);
    const currency = paid[0]?.charge_currency ?? "UGX";
    const months: { key: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toLocaleString(undefined, { month: "short" });
      const total = paid.filter((o) => { const p = new Date(o.paid_at ?? o.created_at); return p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear(); }).reduce((s, o) => s + Number(o.amount_charged || 0), 0);
      months.push({ key, total });
    }
    const orgName = Object.fromEntries(data.orgs.map((o) => [o.id, o.name]));
    const profile = Object.fromEntries(data.profiles.map((p) => [p.id, p]));
    const memberCount: Record<string, number> = {};
    const eventCount: Record<string, number> = {};
    const userOrgs: Record<string, string[]> = {};
    for (const mm of data.members) { memberCount[mm.organization_id] = (memberCount[mm.organization_id] ?? 0) + 1; (userOrgs[mm.user_id] ??= []).push(orgName[mm.organization_id] ?? "—"); }
    for (const e of data.events) eventCount[e.organization_id] = (eventCount[e.organization_id] ?? 0) + 1;
    const failedPayments = data.payments.filter((p) => p.status === "failed").length;
    return { paid, revenue, currency, months, orgName, profile, memberCount, eventCount, userOrgs, failedPayments };
  }, [data]);

  if (isLoading) return <p className="text-xs text-subtle">Loading admin data…</p>;
  if (error || !data || !m) return <Panel title="Access denied"><p className="text-xs text-muted-foreground">{(error as Error)?.message ?? "Administrator access required."}</p></Panel>;

  const s = q.trim().toLowerCase();
  const match = (...v: (string | null | undefined)[]) => !s || v.some((x) => x?.toLowerCase().includes(s));
  const max = Math.max(1, ...m.months.map((x) => x.total));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
        {tab !== "Overview" && tab !== "Billing settings" && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="ml-auto w-full rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none sm:w-64" />
        )}
      </div>

      {tab === "Overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={DollarSign} label="Revenue (paid)" value={formatMoney(m.revenue, m.currency)} hint={`${m.paid.length} paid orders`} />
            <Stat icon={Building2} label="Organizations" value={data.orgs.length} />
            <Stat icon={Users} label="Users" value={data.profiles.length} hint={`${data.admins.length} admins`} />
            <Stat icon={CalendarDays} label="Events" value={data.events.length} />
            <Stat icon={UserCheck} label="Guests" value={data.guestCount.toLocaleString()} />
            <Stat icon={ShieldCheck} label="Check-ins" value={data.checkInCount.toLocaleString()} />
            <Stat icon={CreditCard} label="Failed payments" value={m.failedPayments} />
            <Stat icon={Mail} label="Contact messages" value={data.contacts.length} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Revenue — last 6 months">
              <div className="flex h-40 items-end gap-3">
                {m.months.map((x) => (
                  <div key={x.key} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${(x.total / max) * 100}%`, minHeight: 2 }} title={formatMoney(x.total, m.currency)} />
                    <span className="text-[10px] text-subtle">{x.key}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Recent orders">
              {data.orders.length === 0 ? <p className="text-xs text-subtle">No orders yet.</p> : (
                <ul className="divide-y divide-border">
                  {data.orders.slice(0, 6).map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2 text-xs">
                      <span className="truncate text-foreground">{o.package_snapshot?.name ?? o.reference}<span className="ml-2 text-subtle">{o.buyer_email}</span></span>
                      <span className="flex items-center gap-2"><Badge tone={statusTone(o.status)}>{o.status}</Badge>{formatMoney(Number(o.amount_charged), o.charge_currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <Panel title="Recent activity">
            {data.audit.length === 0 ? <p className="text-xs text-subtle">No activity recorded yet.</p> : (
              <ul className="divide-y divide-border">
                {data.audit.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex justify-between py-2 text-xs"><span className="text-foreground">{a.action} <span className="text-subtle">{a.entity_type}</span></span><span className="text-subtle">{m.orgName[a.organization_id] ?? ""} · {fmtDate(a.created_at)}</span></li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {tab === "Revenue & orders" && (
        <Panel title={`Orders (${data.orders.length})`}>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr>{["Reference", "Customer", "Package", "Amount", "Status", "Payment", "Date"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{data.orders.filter((o) => match(o.reference, o.buyer_email, o.buyer_name, o.status)).map((o) => {
              const pay = data.payments.find((p) => p.order_id === o.id);
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className={`${td} text-foreground`}>{o.reference}</td>
                  <td className={td}>{o.buyer_name}<br /><span className="text-subtle">{o.buyer_email}</span></td>
                  <td className={td}>{o.package_snapshot?.name ?? "—"}</td>
                  <td className={td}>{formatMoney(Number(o.amount_charged), o.charge_currency)}</td>
                  <td className={td}><Badge tone={statusTone(o.status)}>{o.status}</Badge></td>
                  <td className={td}>{pay ? <>{pay.payment_method} <Badge tone={statusTone(pay.status)}>{pay.status}</Badge>{pay.failure_reason && <p className="max-w-xs text-[10px] text-destructive">{pay.failure_reason}</p>}</> : "—"}</td>
                  <td className={td}>{fmtDate(o.created_at)}</td>
                </tr>
              );
            })}</tbody>
          </table>{data.orders.length === 0 && <p className="text-xs text-subtle">No orders yet.</p>}</div>
        </Panel>
      )}

      {tab === "Organizations" && (
        <Panel title={`Organizations (${data.orgs.length})`}>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr>{["Name", "Members", "Events", "Plan", "Created"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{data.orgs.filter((o) => match(o.name, o.slug)).map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className={`${td} text-foreground`}>{o.name} {o.is_demo && <Badge>demo</Badge>}<br /><span className="text-subtle">{o.slug}</span></td>
                <td className={td}>{m.memberCount[o.id] ?? 0}</td>
                <td className={td}>{m.eventCount[o.id] ?? 0}</td>
                <td className={td}>
                  <select value={o.plan} disabled={planMut.isPending} onChange={(e) => planMut.mutate({ orgId: o.id, plan: e.target.value as any })} className="rounded-md border border-border bg-elevated px-2 py-1 text-xs capitalize text-foreground">
                    {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    {!PLANS.includes(o.plan as any) && <option value={o.plan}>{o.plan}</option>}
                  </select>
                </td>
                <td className={td}>{fmtDate(o.created_at)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}

      {tab === "Users" && (
        <Panel title={`Users (${data.profiles.length})`}>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr>{["Name", "Email", "Organizations", "Role", "Joined", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{data.profiles.filter((p) => match(p.full_name, p.email)).map((p) => {
              const isAdm = data.admins.includes(p.id);
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className={`${td} text-foreground`}>{p.full_name ?? "—"}</td>
                  <td className={td}>{p.email}</td>
                  <td className={td}>{(m.userOrgs[p.id] ?? []).join(", ") || "—"}</td>
                  <td className={td}>{isAdm ? <Badge tone="ok">admin</Badge> : <Badge>user</Badge>}</td>
                  <td className={td}>{fmtDate(p.created_at)}</td>
                  <td className={td}>
                    <button type="button" disabled={roleMut.isPending} onClick={() => { if (window.confirm(isAdm ? `Remove admin access from ${p.email}?` : `Make ${p.email} an admin?`)) roleMut.mutate({ userId: p.id, admin: !isAdm }); }} className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary disabled:opacity-50">
                      {isAdm ? "Remove admin" : "Make admin"}
                    </button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </Panel>
      )}

      {tab === "Events" && (
        <Panel title={`Events across all organizations (${data.events.length})`}>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr>{["Event", "Organization", "Date", "Capacity", "Status"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{data.events.filter((e) => match(e.name, m.orgName[e.organization_id], e.status)).map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className={`${td} text-foreground`}>{e.name}</td>
                <td className={td}>{m.orgName[e.organization_id] ?? "—"}</td>
                <td className={td}>{fmtDate(e.event_date)}</td>
                <td className={td}>{e.capacity}</td>
                <td className={td}><Badge tone={statusTone(e.status)}>{e.status}</Badge></td>
              </tr>
            ))}</tbody>
          </table></div>
        </Panel>
      )}

      {tab === "Messages" && (
        <Panel title={`Contact form messages (${data.contacts.length})`}>
          {data.contacts.length === 0 ? <p className="text-xs text-subtle">No messages yet.</p> : (
            <ul className="space-y-3">
              {data.contacts.filter((c) => match(c.name, c.email, c.company, c.message)).map((c) => (
                <li key={c.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between text-xs"><span className="font-medium text-foreground">{c.name} {c.company && <span className="text-subtle">· {c.company}</span>}</span><span className="text-subtle">{fmtDate(c.created_at)}</span></div>
                  <a href={`mailto:${c.email}`} className="text-xs text-primary">{c.email}</a>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{c.message}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === "Billing settings" && billing}
    </div>
  );
}
