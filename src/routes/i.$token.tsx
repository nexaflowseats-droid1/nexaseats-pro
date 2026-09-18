import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarDays, MapPin, Clock, Check, X, HelpCircle } from "lucide-react";
import { BrandMark } from "@/components/marketing/SiteChrome";
import { getInvitation, submitRsvp, type InvitationView } from "@/lib/invitation.functions";
import { formatDate, formatTime } from "@/lib/queries";

export const Route = createFileRoute("/i/$token")({
  head: () => ({
    meta: [
      { title: "Your invitation | Nexa Flow Seats" },
      {
        name: "description",
        content:
          "View your event invitation, confirm your attendance and share dietary or accessibility needs.",
      },
      { property: "og:title", content: "Your invitation | Nexa Flow Seats" },
      {
        property: "og:description",
        content: "Confirm your attendance and see your table for the event.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitationPage,
});

type Choice = "confirmed" | "declined" | "maybe";

function InvitationPage() {
  const { token } = Route.useParams();
  const fetchInvite = useServerFn(getInvitation);
  const sendRsvp = useServerFn(submitRsvp);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => fetchInvite({ data: { token } }) as Promise<InvitationView | null>,
    retry: false,
  });

  const [choice, setChoice] = useState<Choice | null>(null);
  const [diet, setDiet] = useState<string | null>(null);
  const [access, setAccess] = useState<string | null>(null);
  const [plus, setPlus] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: async () =>
      (await sendRsvp({
        data: {
          token,
          rsvp_status: (choice ?? data?.rsvp_status ?? "confirmed") as Choice,
          dietary_requirements: diet ?? data?.dietary_requirements ?? "",
          accessibility_requirements: access ?? data?.accessibility_requirements ?? "",
          plus_ones: plus ?? data?.plus_ones ?? 0,
        },
      })) as InvitationView | null,
    onSuccess: (fresh) => {
      qc.setQueryData(["invitation", token], fresh);
      setSaved(true);
    },
  });

  if (isLoading) {
    return (
      <Frame>
        <p className="font-mono text-xs text-subtle">Loading your invitation…</p>
      </Frame>
    );
  }

  if (isError || !data) {
    return (
      <Frame>
        <h1 className="font-display text-xl text-foreground">Invitation not found</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          This link is invalid or has expired. Please ask the event organizer for a new one.
        </p>
      </Frame>
    );
  }

  const current = choice ?? (data.rsvp_status === "pending" ? null : data.rsvp_status);

  return (
    <Frame>
      <p className="label-mono">You are invited</p>
      <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground">
        {data.event.name}
      </h1>
      <p className="mt-1 font-mono text-[11px] text-subtle">
        For {data.guest.first_name} {data.guest.last_name}
      </p>

      {data.event.description && (
        <p className="mt-4 max-w-[60ch] text-sm text-muted-foreground">{data.event.description}</p>
      )}

      <dl className="mt-5 grid gap-2 sm:grid-cols-3">
        <Fact icon={<CalendarDays className="size-3.5" />} label="Date">
          {formatDate(data.event.event_date)}
        </Fact>
        <Fact icon={<Clock className="size-3.5" />} label="Time">
          {formatTime(data.event.start_time)}
          {data.event.end_time ? ` – ${formatTime(data.event.end_time)}` : ""}
        </Fact>
        <Fact icon={<MapPin className="size-3.5" />} label="Venue">
          {data.event.venue ?? "To be announced"}
        </Fact>
      </dl>

      {data.event.address && (
        <p className="mt-2 font-mono text-[11px] text-subtle">{data.event.address}</p>
      )}

      {data.table && (
        <p className="mt-4 rounded-[8px] border border-primary/30 bg-primary/10 px-3 py-2 font-mono text-[11px] text-primary">
          Your seat: {data.table.name} (table {data.table.table_number})
        </p>
      )}

      {data.message && (
        <p className="mt-4 rounded-[8px] border border-border bg-elevated px-3 py-2 text-sm text-muted-foreground">
          {data.message}
        </p>
      )}

      <form
        className="mt-7 space-y-4 border-t border-border pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p className="label-mono">Will you attend?</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "confirmed", label: "Yes, I'll be there", icon: Check },
              { key: "maybe", label: "Maybe", icon: HelpCircle },
              { key: "declined", label: "Can't make it", icon: X },
            ] as const
          ).map((o) => {
            const Icon = o.icon;
            const active = current === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  setChoice(o.key);
                  setSaved(false);
                }}
                className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 font-mono text-[11px] transition-colors ${
                  active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" /> {o.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dietary requirements">
            <input
              value={diet ?? data.dietary_requirements ?? ""}
              onChange={(e) => {
                setDiet(e.target.value);
                setSaved(false);
              }}
              maxLength={500}
              placeholder="Vegetarian, allergies…"
              className={inputClass}
            />
          </Field>
          <Field label="Accessibility needs">
            <input
              value={access ?? data.accessibility_requirements ?? ""}
              onChange={(e) => {
                setAccess(e.target.value);
                setSaved(false);
              }}
              maxLength={500}
              placeholder="Wheelchair access…"
              className={inputClass}
            />
          </Field>
          <Field label="Additional guests">
            <input
              type="number"
              min={0}
              max={10}
              value={plus ?? data.plus_ones}
              onChange={(e) => {
                setPlus(Math.max(0, Math.min(10, Number(e.target.value) || 0)));
                setSaved(false);
              }}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || (!current && data.rsvp_status === "pending")}
            className="rounded-[8px] bg-primary px-4 py-2 font-mono text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Sending…" : "Send my response"}
          </button>
          {saved && <span className="font-mono text-[11px] text-accent">Response saved.</span>}
          {mutation.isError && (
            <span className="font-mono text-[11px] text-destructive">
              Something went wrong. Please try again.
            </span>
          )}
        </div>
      </form>
    </Frame>
  );
}

const inputClass =
  "w-full rounded-[8px] border border-input bg-surface px-3 py-2 font-mono text-[11px] text-foreground outline-none focus:border-primary/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-border bg-surface px-3 py-2.5">
      <dt className="flex items-center gap-1.5 label-mono">
        {icon} {label}
      </dt>
      <dd className="mt-1 font-display text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Nexa<span className="text-primary"> Flow</span> Seats
          </span>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
