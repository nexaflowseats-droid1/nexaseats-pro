import { useEffect, useState } from "react";
import { useOrg } from "@/lib/org-context";
import { useEvents } from "@/lib/queries";

/** Shared "which event am I operating on" selector used by module pages. */
export function useActiveEvent() {
  const { currentOrgId } = useOrg();
  const { data: events, isLoading } = useEvents(currentOrgId);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!events || events.length === 0) return;
    setEventId((prev) => (prev && events.some((e) => e.id === prev) ? prev : events[0]!.id));
  }, [events]);

  return { events: events ?? [], eventId, setEventId, isLoading };
}

export function EventPicker({
  events,
  eventId,
  onChange,
}: {
  events: { id: string; name: string }[];
  eventId: string | null;
  onChange: (id: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <label className="flex items-center gap-2">
      <span className="label-mono">Event</span>
      <select
        value={eventId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[8px] border border-input bg-surface px-3 py-1.5 font-mono text-[11px] text-foreground outline-none focus:border-primary/60"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );
}
