import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-7" : "size-8";
  const dot = size === "sm" ? "size-1.5" : "size-2";
  return (
    <span
      className={`grid ${box} place-items-center rounded-[10px] bg-primary/10 ring-1 ring-primary/30`}
    >
      <span
        className={`${dot} rounded-full bg-primary`}
        style={{ boxShadow: "0 0 10px 2px color-mix(in oklab, var(--primary) 60%, transparent)" }}
      />
    </span>
  );
}

export function BrandLock() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-sm font-semibold tracking-tight text-foreground">
        Nexa<span className="text-primary"> Flow</span> Seats
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/features", label: "Features" },
  { to: "/solutions", label: "Solutions" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <BrandLock />
          <nav className="hidden items-center gap-7 font-mono text-xs text-muted-foreground md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="transition-colors hover:text-foreground"
                activeProps={{ className: "text-primary" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="hidden font-mono text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Login
            </Link>
            <Link
              to="/auth"
              className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground ring-1 ring-primary/40 transition-colors hover:bg-primary-bright"
            >
              Start Free
            </Link>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="grid size-9 place-items-center rounded-[8px] text-muted-foreground ring-1 ring-border md:hidden"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-border py-3 font-mono text-xs md:hidden">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded px-2 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { to: "/features", label: "Features" },
      { to: "/pricing", label: "Pricing" },
      { to: "/solutions", label: "Solutions" },
      { to: "/auth", label: "Start free" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/contact", label: "Contact" },
      { to: "/contact", label: "Book a demo" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy policy" },
      { to: "/terms", label: "Terms of service" },
      { to: "/security", label: "Security" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface/40">
      <div className="glow-orb -bottom-20 left-1/3 size-72 bg-primary/10" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 rounded-xl border border-border bg-background/60 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-lg font-medium text-foreground">
              Ready to seat your next event?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Free to start. Sample event included.
            </p>
          </div>
          <Link
            to="/auth"
            className="rounded-[8px] bg-primary px-5 py-2.5 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright"
          >
            Start Free
          </Link>
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <BrandLock />
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
              Smart Seating. Seamless Events. Powered by AI. Guests, floor plans, QR check-in and
              live operations in one place.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-foreground">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="relative border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} Nexa Flow Seats. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-success" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] text-primary">{eyebrow}</p>
      <h2 className="mt-3 max-w-[40ch] text-balance font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {children}
    </div>
  );
}
