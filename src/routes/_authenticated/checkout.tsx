import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
import { z } from "zod";
import { AppShell, Panel } from "@/components/app/AppShell";
import { useOrg } from "@/lib/org-context";
import { supabase } from "@/integrations/supabase/client";
import {
  eventsLabel,
  formatMoney,
  formatUsd,
  guestsLabel,
  usePricingPackages,
  validityLabel,
} from "@/lib/pricing";
import { checkPayment, startCheckout } from "@/lib/checkout.functions";

const search = z.object({
  packageId: z.string().optional(),
  paymentId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/checkout")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Checkout — Nexa Flow Seats" },
      { name: "description", content: "Complete your NexaSeats order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

type Phase = "form" | "processing" | "verifying" | "success" | "failed";

function CheckoutPage() {
  const { packageId, paymentId: returnedPaymentId } = Route.useSearch();
  const { currentOrgId } = useOrg();
  const { data: packages, isLoading } = usePricingPackages();
  const pkg = packages?.find((p) => p.id === packageId);
  const qc = useQueryClient();
  const start = useServerFn(startCheckout);
  const check = useServerFn(checkPayment);

  const { data: rate } = useQuery({
    queryKey: ["fx-rate"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("key,value");
      return {
        rate: Number(data?.find((r) => r.key === "usd_ugx_rate")?.value ?? 3800),
        currency: data?.find((r) => r.key === "payment_currency")?.value ?? "UGX",
      };
    },
  });

  const [method, setMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [phase, setPhase] = useState<Phase>(returnedPaymentId ? "verifying" : "form");
  const [paymentId, setPaymentId] = useState<string | null>(returnedPaymentId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkPayment>> | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail((e) => e || data.user!.email!);
      const n = data.user?.user_metadata?.full_name as string | undefined;
      if (n) setName((v) => v || n);
    });
  }, []);

  // Poll the server until the provider reports a final status.
  useEffect(() => {
    if (!paymentId || (phase !== "processing" && phase !== "verifying")) return;
    let cancelled = false;
    tries.current = 0;
    const tick = async () => {
      if (cancelled) return;
      tries.current += 1;
      try {
        const r = await check({ data: { paymentId } });
        if (cancelled) return;
        setResult(r);
        if (r.status === "successful") {
          setPhase("success");
          qc.invalidateQueries({ queryKey: ["billing"] });
          return;
        }
        if (r.status === "failed" || r.status === "cancelled") {
          setError(r.failure_reason ?? "The payment was not completed.");
          setPhase("failed");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (tries.current < 60) setTimeout(tick, 5000);
      else {
        setError("We haven't received confirmation yet. Check Billing in a few minutes.");
        setPhase("failed");
      }
    };
    const t = setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [paymentId, phase, check, qc]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!pkg) return;
    setError(null);
    try {
      setPhase("processing");
      const r = await start({
        data: {
          packageId: pkg.id,
          organizationId: currentOrgId,
          method,
          phoneNumber: method === "mobile_money" ? phone : null,
          buyerName: name,
          buyerEmail: email,
          eventTitle: eventTitle || null,
          eventDate: eventDate || null,
          baseUrl: window.location.origin,
        },
      });
      setPaymentId(r.paymentId);
      if (r.redirectUrl) {
        sessionStorage.setItem("nxs-payment", r.paymentId);
        window.location.href = r.redirectUrl;
        return;
      }
      if (method === "card") setPhase("verifying");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment Failed");
      setPhase("failed");
    }
  }

  const amount = pkg && rate ? Math.round(Number(pkg.price) * rate.rate) : null;
  const input =
    "w-full rounded-[8px] border border-border bg-elevated px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none";

  return (
    <AppShell title="Complete your order" subtitle="NexaSeats checkout">
      {isLoading ? (
        <p className="font-mono text-xs text-subtle">Loading package…</p>
      ) : !pkg && phase === "form" ? (
        <Panel title="No package selected">
          <p className="font-mono text-xs text-muted-foreground">
            Choose a package first.{" "}
            <Link to="/pricing" className="text-primary underline">
              View pricing
            </Link>
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Panel title={phase === "form" ? "Event details & payment" : "Payment status"}>
            {phase === "form" && (
              <form onSubmit={pay} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="label-mono">Full name</span>
                    <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={input} />
                  </label>
                  <label className="space-y-1">
                    <span className="label-mono">Email</span>
                    <input required type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
                  </label>
                  <label className="space-y-1">
                    <span className="label-mono">Event name (optional)</span>
                    <input maxLength={160} value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className={input} />
                  </label>
                  <label className="space-y-1">
                    <span className="label-mono">Event date (optional)</span>
                    <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={input} />
                  </label>
                </div>
                <fieldset className="space-y-2">
                  <legend className="label-mono">Payment method</legend>
                  {(["mobile_money", "card"] as const).map((m) => (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-center gap-3 rounded-[8px] border px-3 py-2.5 font-display text-sm ${
                        method === m ? "border-primary/60 bg-primary/5 text-foreground" : "border-border text-muted-foreground"
                      }`}
                    >
                      <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--primary)]" />
                      {m === "mobile_money" ? "Mobile Money" : "Card"}
                    </label>
                  ))}
                </fieldset>
                {method === "mobile_money" && (
                  <label className="block space-y-1">
                    <span className="label-mono">Mobile money number</span>
                    <input required inputMode="tel" placeholder="0772 123456" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
                  </label>
                )}
                <button type="submit" className="w-full rounded-[8px] bg-primary px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground hover:bg-primary-bright">
                  Pay Now {amount && rate ? `· ${formatMoney(amount, rate.currency)}` : ""}
                </button>
              </form>
            )}
            {(phase === "processing" || phase === "verifying") && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="font-display text-lg text-foreground">
                  {phase === "processing" ? "Processing Payment" : "Verifying Payment…"}
                </p>
                {phase === "processing" && method === "mobile_money" && (
                  <p className="font-mono text-xs text-muted-foreground">Please approve the payment on your phone.</p>
                )}
              </div>
            )}
            {phase === "success" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Check className="size-10 text-accent" />
                <p className="font-display text-lg text-foreground">Payment Successful</p>
                <p className="font-mono text-xs text-muted-foreground">
                  Order {result?.orders.reference} is paid. {result?.orders.package_snapshot.event_limit} event credit
                  {result?.orders.package_snapshot.event_limit === 1 ? "" : "s"} added to your account.
                </p>
                <Link to="/billing" className="rounded-[8px] bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground">
                  Go to Billing
                </Link>
              </div>
            )}
            {phase === "failed" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <X className="size-10 text-destructive" />
                <p className="font-display text-lg text-foreground">Payment Failed</p>
                <p className="max-w-md font-mono text-xs text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("form");
                    setPaymentId(null);
                    setError(null);
                  }}
                  className="rounded-[8px] border border-border px-4 py-2 font-display text-sm text-foreground hover:bg-secondary"
                >
                  Try again
                </button>
              </div>
            )}
          </Panel>
          {pkg && (
            <Panel title="Order summary">
              <div className="space-y-2 font-mono text-xs">
                <p className="font-display text-lg text-foreground">{pkg.name}</p>
                <p className="text-muted-foreground">{eventsLabel(pkg)}</p>
                <p className="text-muted-foreground">{guestsLabel(pkg)}</p>
                <p className="text-muted-foreground">{validityLabel(pkg)}</p>
                <p className="text-muted-foreground">
                  {pkg.package_features.filter((f) => f.included).length} of {pkg.package_features.length} features included
                </p>
                <div className="border-t border-border pt-2">
                  <p className="flex justify-between text-foreground">
                    <span>Price</span>
                    <span>{formatUsd(pkg.price)}</span>
                  </p>
                  {amount && rate && (
                    <p className="flex justify-between text-subtle">
                      <span>Charged in {rate.currency}</span>
                      <span>{formatMoney(amount, rate.currency)}</span>
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </AppShell>
  );
}
