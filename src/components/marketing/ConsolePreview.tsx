const KPIS = [
  { label: "Guests", value: "1,284", delta: "+64 today" },
  { label: "Checked in", value: "912", delta: "71% arrival" },
  { label: "Tables seated", value: "118 / 128", delta: "10 open" },
  { label: "Conflicts", value: "0", delta: "resolved by AI" },
];

const TABLES = [
  { id: "T-01", x: 14, y: 22, seats: 10, filled: 10 },
  { id: "T-02", x: 38, y: 16, seats: 10, filled: 8 },
  { id: "T-03", x: 62, y: 24, seats: 8, filled: 8 },
  { id: "T-04", x: 84, y: 18, seats: 8, filled: 5 },
  { id: "T-05", x: 20, y: 58, seats: 10, filled: 9 },
  { id: "T-06", x: 45, y: 64, seats: 12, filled: 12 },
  { id: "T-07", x: 70, y: 56, seats: 10, filled: 6 },
  { id: "T-08", x: 88, y: 70, seats: 8, filled: 8 },
];

/** Static product preview used on the marketing site. */
export function ConsolePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[11px] text-subtle">
          <span className="size-2 rounded-full bg-primary/70" />
          nexa://console/annual-gala-2026/seating
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" /> live
        </span>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="bg-surface px-4 py-4">
            <p className="label-mono">{k.label}</p>
            <p className="mt-1.5 font-display text-2xl font-medium text-foreground">{k.value}</p>
            <p className="font-mono text-[11px] text-subtle">{k.delta}</p>
          </div>
        ))}
      </div>

      <div className="relative h-[260px] border-t border-border sm:h-[320px]">
        <div className="gridbg absolute inset-0" />
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-primary/30 bg-primary/10 px-6 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Stage
        </div>
        {TABLES.map((t) => {
          const full = t.filled === t.seats;
          return (
            <div
              key={t.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${t.x}%`, top: `${t.y + 18}%` }}
            >
              <div
                className={`grid size-14 place-items-center rounded-full border text-center ${
                  full ? "border-accent/40 bg-accent/10" : "border-primary/40 bg-primary/10"
                }`}
              >
                <span className="font-mono text-[10px] text-foreground">{t.id}</span>
                <span className="font-mono text-[9px] text-subtle">
                  {t.filled}/{t.seats}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
