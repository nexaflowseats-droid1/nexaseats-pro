GRANT SELECT ON public.app_settings TO anon;
CREATE POLICY "public pricing settings" ON public.app_settings FOR SELECT TO anon
  USING (key IN ('usd_ugx_rate','payment_currency','setup_time_standard','setup_time_extended','support_standard','support_extended'));