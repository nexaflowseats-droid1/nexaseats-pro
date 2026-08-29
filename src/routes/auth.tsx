import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { BrandMark } from "@/components/marketing/SiteChrome";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Sign in or create your Nexa Flow Seats account to manage events, guests and seating.",
      },
      { property: "og:title", content: "Sign in — Nexa Flow Seats" },
      { property: "og:description", content: "Access your Nexa Flow Seats event console." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Use at least 8 characters").max(72);

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary/60";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const emailResult = emailSchema.safeParse(fd.get("email"));
    if (!emailResult.success) {
      setError(emailResult.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    const email = emailResult.data;
    setError(null);
    setBusy(true);

    if (mode === "forgot") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      setBusy(false);
      if (err) return setError(err.message);
      toast.success("Password reset link sent. Check your inbox.");
      setMode("signin");
      return;
    }

    const passwordResult = passwordSchema.safeParse(fd.get("password"));
    if (!passwordResult.success) {
      setBusy(false);
      return setError(passwordResult.error.issues[0]?.message ?? "Invalid password");
    }
    const password = passwordResult.data;

    if (mode === "signup") {
      const fullName = String(fd.get("fullName") ?? "").trim().slice(0, 100);
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName },
        },
      });
      setBusy(false);
      if (err) return setError(err.message);
      toast.success("Account created. Check your email to verify, then sign in.");
      setMode("signin");
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) return setError(err.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in is unavailable right now.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-12">
      <div className="gridbg-fade pointer-events-none absolute inset-0" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <BrandMark />
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Nexa<span className="text-primary"> Flow</span> Seats
          </span>
        </Link>

        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="label-mono">
            {mode === "signin" ? "Access console" : mode === "signup" ? "New account" : "Recovery"}
          </p>
          <h1 className="mt-2 font-display text-xl font-medium text-foreground">
            {mode === "signin"
              ? "Sign in to your console"
              : mode === "signup"
                ? "Start free"
                : "Reset your password"}
          </h1>

          <form onSubmit={handleSubmit} className="mt-6" noValidate>
            {mode === "signup" && (
              <label className="mb-4 block">
                <span className="label-mono">Full name</span>
                <input name="fullName" className={FIELD} placeholder="Amara Osei" maxLength={100} />
              </label>
            )}
            <label className="block">
              <span className="label-mono">Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className={FIELD}
                placeholder="you@company.com"
                maxLength={255}
              />
            </label>
            {mode !== "forgot" && (
              <label className="mt-4 block">
                <span className="label-mono">Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={FIELD}
                  placeholder="••••••••"
                  maxLength={72}
                />
              </label>
            )}

            {error && (
              <p className="mt-4 rounded-[8px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-[8px] bg-primary px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-bright disabled:opacity-60"
            >
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
                  or
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                className="w-full rounded-[8px] border border-border px-4 py-2.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
              >
                Continue with Google
              </button>
            </>
          )}

          <div className="mt-6 flex items-center justify-between font-mono text-[11px] text-subtle">
            {mode === "signin" ? (
              <>
                <button type="button" onClick={() => setMode("forgot")} className="hover:text-foreground">
                  Forgot password?
                </button>
                <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Create account
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMode("signin")} className="hover:text-foreground">
                ← Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
