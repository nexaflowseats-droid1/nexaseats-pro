import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  LayoutGrid,
  FileText,
  QrCode,
  Mail,
  MessageSquare,
  BarChart3,
  UsersRound,
  CreditCard,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/marketing/SiteChrome";
import { useOrg, ROLE_LABEL } from "@/lib/org-context";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/seating", label: "Seating Designer", icon: LayoutGrid },
  { to: "/documents", label: "Documents & PDFs", icon: FileText },
  { to: "/check-in", label: "Check-In", icon: QrCode },
  { to: "/invitations", label: "Invitations", icon: Mail },
  { to: "/communications", label: "Communications", icon: MessageSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/team", label: "Team", icon: UsersRound },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function OrgSwitcher() {
  const { memberships, currentOrg, setCurrentOrgId } = useOrg();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-[8px] border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-elevated"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-xs font-medium text-foreground">
            {currentOrg?.organizations.name ?? "No organization"}
          </span>
          <span className="block font-mono text-[10px] text-subtle">
            {currentOrg ? ROLE_LABEL[currentOrg.role] : "—"}
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-subtle" />
      </button>
      {open && memberships.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[8px] border border-border bg-elevated shadow-xl">
          {memberships.map((m) => (
            <button
              key={m.organization_id}
              type="button"
              onClick={() => {
                setCurrentOrgId(m.organization_id);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left font-mono text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {m.organizations.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNav, setMobileNav] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link to="/dashboard" className="flex items-center gap-2.5 px-1 py-2">
        <BrandMark size="sm" />
        <span className="font-display text-xs font-semibold tracking-tight text-foreground">
          Nexa<span className="text-primary"> Flow</span> Seats
        </span>
      </Link>
      <OrgSwitcher />
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV.map((n) => {
          const active = pathname === n.to || pathname.startsWith(n.to + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setMobileNav(false)}
              className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2 font-mono text-[11px] transition-colors ${
                active
                  ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5 shrink-0" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="size-3.5" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-sidebar lg:block">
        {sidebar}
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80"
            onClick={() => setMobileNav(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-sidebar">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setMobileNav(true)}
                className="grid size-9 place-items-center rounded-[8px] text-muted-foreground ring-1 ring-border lg:hidden"
              >
                {mobileNav ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
              <div>
                <h1 className="font-display text-lg font-medium tracking-tight text-foreground">
                  {title}
                </h1>
                {subtitle && <p className="font-mono text-[11px] text-subtle">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        </header>
        <main className="px-5 py-6">{children}</main>
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="label-mono">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent" | "primary";
}) {
  const color =
    tone === "accent" ? "text-accent" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-4">
      <p className="label-mono">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-medium ${color}`}>{value}</p>
      {hint && <p className="font-mono text-[11px] text-subtle">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <p className="font-display text-sm text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] font-mono text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
