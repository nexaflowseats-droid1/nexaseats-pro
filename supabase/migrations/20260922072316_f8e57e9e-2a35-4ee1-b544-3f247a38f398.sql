
-- SETTINGS -------------------------------------------------------------
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by authenticated" ON public.app_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings(key, value, description) VALUES
  ('usd_ugx_rate', '3800', 'Fixed USD to UGX conversion rate used when charging mobile money'),
  ('payment_currency', 'UGX', 'Currency sent to the payment provider');

-- PACKAGES -------------------------------------------------------------
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('standard','extended')),
  group_label TEXT NOT NULL CHECK (group_label IN ('single','manager')),
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  event_limit INTEGER NOT NULL DEFAULT 1,
  guest_limit INTEGER NOT NULL,
  validity_days INTEGER,
  savings NUMERIC(10,2) NOT NULL DEFAULT 0,
  setup_time TEXT,
  support_level TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages public read" ON public.packages FOR SELECT TO anon, authenticated USING (is_active);
CREATE TRIGGER packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.features TO anon, authenticated;
GRANT ALL ON public.features TO service_role;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "features public read" ON public.features FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER features_updated BEFORE UPDATE ON public.features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.package_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  included BOOLEAN NOT NULL DEFAULT true,
  limit_value INTEGER,
  limit_unit TEXT,
  custom_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, feature_id)
);
CREATE INDEX package_features_package_idx ON public.package_features(package_id);
GRANT SELECT ON public.package_features TO anon, authenticated;
GRANT ALL ON public.package_features TO service_role;
ALTER TABLE public.package_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "package features public read" ON public.package_features FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER package_features_updated BEFORE UPDATE ON public.package_features FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDERS ---------------------------------------------------------------
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  package_id UUID NOT NULL REFERENCES public.packages(id),
  package_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_charged NUMERIC(14,2) NOT NULL,
  charge_currency TEXT NOT NULL DEFAULT 'UGX',
  fx_rate NUMERIC(14,4) NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  credits_granted BOOLEAN NOT NULL DEFAULT false,
  buyer_name TEXT,
  buyer_email TEXT,
  event_title TEXT,
  event_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON public.orders(user_id);
CREATE INDEX orders_status_idx ON public.orders(status);
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'UGX',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money','card')),
  phone_number TEXT,
  provider_reference TEXT,
  provider_transaction_uuid TEXT,
  provider_transaction_id TEXT,
  redirect_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','successful','failed','cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  callback_received_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON public.payments(order_id);
CREATE UNIQUE INDEX payments_provider_reference_idx ON public.payments(provider_reference) WHERE provider_reference IS NOT NULL;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments read" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.packages(id),
  credits_total INTEGER NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  guest_limit INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_credits_org_idx ON public.event_credits(organization_id);
GRANT SELECT ON public.event_credits TO authenticated;
GRANT ALL ON public.event_credits TO service_role;
ALTER TABLE public.event_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits readable by owner or org member" ON public.event_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)));
CREATE TRIGGER event_credits_updated BEFORE UPDATE ON public.event_credits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SEED: features -------------------------------------------------------
INSERT INTO public.features (name, slug, description, category, sort_order) VALUES
 ('QR / Mobile Friendly','qr-mobile-friendly','Guests access their seating and event information via QR codes and mobile-friendly pages.','Core Event',1),
 ('Anonymous View','anonymous-view','Guests view the event experience without creating an account or logging in.','Core Event',2),
 ('Templates & Customization','templates-customization','Customize the event experience with templates and branding options.','Design & Customization',3),
 ('Tablemate Management','tablemate-management','Manage and display tablemate information for each guest.','Seating',4),
 ('Backend Login','backend-login','Organizer access to the management console for their event.','Access & Management',5),
 ('Setup Time','setup-time','The setup time applicable to this package.','Service',6),
 ('Event Countdown','event-countdown','Countdown to the event shown to guests.','Core Event',7),
 ('Photo Background','photo-background','Use a photo or image as the event background.','Design & Customization',8),
 ('Floorplan Upload','floorplan-upload','Upload and use an event floorplan.','Seating',9),
 ('Menu Upload','menu-upload','Upload and display the event menu.','Event Content',10),
 ('Event Schedule','event-schedule','Publish the event schedule to guests.','Core Event',11),
 ('AI Seat Optimizer','ai-seat-optimizer','AI-powered seating optimization with relationships and constraints.','Seating',12),
 ('Realtime Check-In Tracking','realtime-check-in','Monitor guest check-ins as they happen.','Check-In',13),
 ('Guest Photos Upload','guest-photos-upload','Guests and organizers upload event photos.','Guest Experience',14),
 ('Support','support','The support level included with this package.','Service',15);

-- SEED: packages -------------------------------------------------------
INSERT INTO public.packages (name, slug, tier, group_label, description, price, event_limit, guest_limit, validity_days, savings, sort_order) VALUES
 ('Standard','single-standard','standard','single','Single event seating with the essentials.',49.99,1,500,NULL,0,1),
 ('Extended','single-extended','extended','single','Single event with the full NexaSeats toolkit.',99.99,1,1000,NULL,0,2),
 ('5 Events — Standard','manager-5-standard','standard','manager','Five events for event managers.',200.00,5,500,365,50.00,3),
 ('5 Events — Extended','manager-5-extended','extended','manager','Five events with every feature unlocked.',400.00,5,1000,365,100.00,4),
 ('10 Events — Standard','manager-10-standard','standard','manager','Ten events for busy event teams.',400.00,10,500,365,100.00,5),
 ('10 Events — Extended','manager-10-extended','extended','manager','Ten events with every feature unlocked.',800.00,10,1000,365,200.00,6);

-- SEED: matrix ---------------------------------------------------------
INSERT INTO public.package_features (package_id, feature_id, included, sort_order, limit_value, limit_unit)
SELECT p.id, f.id,
  CASE WHEN p.tier = 'standard' AND f.slug IN ('anonymous-view','ai-seat-optimizer','guest-photos-upload') THEN false ELSE true END,
  f.sort_order,
  NULL, NULL
FROM public.packages p CROSS JOIN public.features f;
