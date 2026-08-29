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
        style={{ boxShadow: "0 0 10px 2px oklch(0.807 0.132 76 / 0.6)" }}
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
      <span className="ml-1 hidden font-mono text-[10px] text-subtle sm:inline">v2.4</span>
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
              search={{ mode: "signup" }}
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

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-sm font-semibold text-foreground">
              Nexa Flow Seats
            </span>
          </div>
          <p className="mt-3 max-w-[34ch] font-mono text-xs leading-relaxed text-subtle">
            Smart Seating. Seamless Events. Powered by AI. Built for event operations teams who run
            it live.
          </p>
        </div>
        <div className="flex gap-8 font-mono text-xs text-subtle">
          <Link to="/features" className="hover:text-foreground">
            Product
          </Link>
          <Link to="/solutions" className="hover:text-foreground">
            Solutions
          </Link>
          <Link to="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link to="/contact" className="hover:text-foreground">
            Contact
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 font-mono text-[11px] text-subtle sm:px-8">
          <span>© {new Date().getFullYear()} Nexa Flow Seats · SOC 2 Type II</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent" />
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
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 max-w-[40ch] text-balance font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {children}
    </div>
  );
}
