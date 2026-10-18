import { useRef, type ReactNode, type MouseEvent } from "react";

/** Rotating 3D floor with tables and seats, pure CSS transforms. */
export function HeroScene() {
  const tables = [
    { x: 0, y: 0, seats: 10, r: 70 },
    { x: -220, y: -120, seats: 8, r: 52 },
    { x: 220, y: -120, seats: 8, r: 52 },
    { x: -220, y: 140, seats: 8, r: 52 },
    { x: 220, y: 140, seats: 8, r: 52 },
  ];
  return (
    <div className="scene-3d pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="glow-orb left-[10%] top-[15%] size-72 bg-primary/25" />
      <div className="glow-orb right-[8%] top-[40%] size-80 bg-accent/20 [animation-delay:-4s]" />
      <div className="floor-3d absolute left-1/2 top-[58%]">
        <div className="floor-spin relative">
          <div className="floor-grid absolute -left-[400px] -top-[400px] size-[800px] rounded-full" />
          {tables.map((t, i) => (
            <div
              key={i}
              className="absolute"
              style={{ transform: `translate(${t.x}px, ${t.y}px)`, transformStyle: "preserve-3d" }}
            >
              <div
                className="table-3d absolute rounded-full"
                style={{ width: t.r, height: t.r, left: -t.r / 2, top: -t.r / 2 }}
              />
              {Array.from({ length: t.seats }).map((_, s) => {
                const a = (s / t.seats) * Math.PI * 2;
                const d = t.r / 2 + 16;
                return (
                  <span
                    key={s}
                    className={`seat-3d absolute size-3 rounded-full ${(s + i) % 3 === 0 ? "bg-accent" : "bg-primary"}`}
                    style={{
                      left: Math.cos(a) * d - 6,
                      top: Math.sin(a) * d - 6,
                      animationDelay: `${(s + i) * 0.18}s`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

/** Wraps content in a mouse-reactive 3D tilt. */
export function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "rotateX(10deg) rotateY(0deg)";
  };
  return (
    <div className="[perspective:1600px]" onMouseMove={onMove} onMouseLeave={reset}>
      <div
        ref={ref}
        className="tilt-card rounded-xl"
        style={{ transform: "rotateX(10deg) rotateY(0deg)" }}
      >
        {children}
      </div>
    </div>
  );
}
