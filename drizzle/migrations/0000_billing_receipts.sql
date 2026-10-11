
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1001;
GRANT USAGE ON SEQUENCE public.receipt_number_seq TO service_role;

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  file_path text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','refunded','partially_refunded')),
  verification_code text NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receipts_user_idx ON public.receipts(user_id);
CREATE INDEX receipts_org_idx ON public.receipts(organization_id);
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or org receipts" ON public.receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (organization_id IS NOT NULL AND public.is_org_member(organization_id)) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER receipts_updated BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.receipt_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'initial' CHECK (kind IN ('initial','resend')),
  recipient text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','delivered','failed','bounced')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  failure_reason text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX receipt_emails_one_initial ON public.receipt_emails(receipt_id) WHERE kind = 'initial';
CREATE INDEX receipt_emails_order_idx ON public.receipt_emails(order_id);
GRANT SELECT ON public.receipt_emails TO authenticated;
GRANT ALL ON public.receipt_emails TO service_role;
ALTER TABLE public.receipt_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read receipt emails" ON public.receipt_emails FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.receipts r WHERE r.id = receipt_id AND (r.user_id = auth.uid() OR (r.organization_id IS NOT NULL AND public.is_org_member(r.organization_id)))) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER receipt_emails_updated BEFORE UPDATE ON public.receipt_emails FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'recorded',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read refunds" ON public.refunds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR (o.organization_id IS NOT NULL AND public.is_org_member(o.organization_id)))) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'NXS-R-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0')
$$;
REVOKE EXECUTE ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO service_role;

INSERT INTO public.app_settings (key, value, description) VALUES
  ('business_email', NULL, 'Business email shown on receipts'),
  ('business_website', NULL, 'Website shown on receipts'),
  ('business_address', NULL, 'Business address shown on receipts'),
  ('business_phone', NULL, 'Business telephone shown on receipts'),
  ('support_email', NULL, 'Support email in receipts and receipt emails'),
  ('refund_policy_url', NULL, 'Refund policy link on receipts'),
  ('receipt_sender', NULL, 'From address for receipt emails, e.g. Nexa Flow Seats <billing@yourdomain.com>'),
  ('setup_time_standard', NULL, 'Setup time for STANDARD packages (proposed: Within 24 hours)'),
  ('setup_time_extended', NULL, 'Setup time for EXTENDED packages (proposed: Within 12 hours)'),
  ('support_standard', NULL, 'Support level for STANDARD packages (proposed: Standard Support)'),
  ('support_extended', NULL, 'Support level for EXTENDED packages (proposed: Priority Support)')
ON CONFLICT (key) DO NOTHING;
