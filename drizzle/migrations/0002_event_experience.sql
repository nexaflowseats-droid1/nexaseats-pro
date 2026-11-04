ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS menu jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS layout_elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS floorplan_path text,
  ADD COLUMN IF NOT EXISTS floorplan_opacity numeric NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS kiosk_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.guest_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  caption text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.guest_photos TO authenticated;
GRANT ALL ON public.guest_photos TO service_role;
ALTER TABLE public.guest_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event team reads photos" ON public.guest_photos FOR SELECT TO authenticated USING (public.can_access_event(event_id));
CREATE POLICY "event team moderates photos" ON public.guest_photos FOR UPDATE TO authenticated USING (public.can_access_event(event_id));
CREATE POLICY "event team deletes photos" ON public.guest_photos FOR DELETE TO authenticated USING (public.can_access_event(event_id));
CREATE INDEX guest_photos_event_idx ON public.guest_photos(event_id);