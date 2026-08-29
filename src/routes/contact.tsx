import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { MarketingPage, SectionHeading } from "@/components/marketing/SiteChrome";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Demo — Nexa Flow Seats" },
      {
        name: "description",
        content:
          "Book a demo or talk to the Nexa Flow Seats team about seating, check-in and enterprise deployments.",
      },
      { property: "og:title", content: "Contact & Demo — Nexa Flow Seats" },
      {
        property: "og:description",
        content: "Tell us about your event and we'll show you the console in action.",
      },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Tell us a little more").max(1500),
});

const FIELD =
  "mt-1.5 w-full rounded-[8px] border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary/60";

function ContactPage() {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      company: fd.get("company"),
      message: fd.get("message"),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company ?? null,
      message: parsed.data.message,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not send your message. Please try again.");
      return;
    }
    setSent(true);
    toast.success("Message received — we'll be in touch shortly.");
  }

  return (
    <MarketingPage>
      <section>
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2">
          <SectionHeading eyebrow="Contact" title="Book a demo or talk to the team.">
            <p className="mt-4 max-w-[52ch] font-mono text-xs leading-relaxed text-muted-foreground">
              Tell us the size of your event, the venue and what usually goes wrong. We'll walk you
              through the console with your scenario loaded.
            </p>
            <dl className="mt-8 space-y-4 font-mono text-xs">
              <div>
                <dt className="label-mono">Sales</dt>
                <dd className="mt-1 text-foreground">sales@nexaflowseats.com</dd>
              </div>
              <div>
                <dt className="label-mono">Support</dt>
                <dd className="mt-1 text-foreground">support@nexaflowseats.com</dd>
              </div>
              <div>
                <dt className="label-mono">Response time</dt>
                <dd className="mt-1 text-accent">under 1 business day</dd>
              </div>
            </dl>
          </SectionHeading>

          <div className="rounded-xl border border-border bg-surface p-6">
            {sent ? (
              <div className="py-10 text-center">
                <p className="label-mono">Transmission complete</p>
                <h3 className="mt-3 font-display text-xl text-foreground">Thanks — message sent.</h3>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  A member of the team will reply to you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="label-mono">Name</span>
                    <input name="name" className={FIELD} placeholder="Amara Osei" maxLength={100} />
                    {errors["name"] && (
                      <span className="mt-1 block font-mono text-[11px] text-destructive">
                        {errors["name"]}
                      </span>
                    )}
                  </label>
                  <label className="block">
                    <span className="label-mono">Email</span>
                    <input
                      name="email"
                      type="email"
                      className={FIELD}
                      placeholder="you@company.com"
                      maxLength={255}
                    />
                    {errors["email"] && (
                      <span className="mt-1 block font-mono text-[11px] text-destructive">
                        {errors["email"]}
                      </span>
                    )}
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="label-mono">Company / Organization</span>
                  <input
                    name="company"
                    className={FIELD}
                    placeholder="Nexa Events Group"
                    maxLength={120}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="label-mono">What are you planning?</span>
                  <textarea
                    name="message"
                    rows={5}
                    maxLength={1500}
                    className={FIELD}
                    placeholder="800-guest awards gala, 80 tables, VIP seating near stage…"
                  />
                  {errors["message"] && (
                    <span className="mt-1 block font-mono text-[11px] text-destructive">
                      {errors["message"]}
                    </span>
                  )}
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-6 w-full rounded-[8px] bg-primary px-4 py-2.5 font-display text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-bright disabled:opacity-60"
                >
                  {saving ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
