import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { resolveServiceValue } from '@/lib/billing';

export type PackageRow = Database['public']['Tables']['packages']['Row'];
export type FeatureRow = Database['public']['Tables']['features']['Row'];

export type PackageFeature = {
  included: boolean;
  limit_value: number | null;
  limit_unit: string | null;
  custom_value: string | null;
  sort_order: number;
  features: FeatureRow;
};

export type PricingPackage = PackageRow & { package_features: PackageFeature[] };

export const FEATURE_CATEGORIES = [
  'Core Event',
  'Design & Customization',
  'Seating',
  'Event Content',
  'Check-In',
  'Guest Experience',
  'Access & Management',
  'Service',
] as const;

/** Features whose value is configured per package rather than simply on/off. */
export const VALUE_FEATURES = ['setup-time', 'support'];

export function usePricingPackages() {
  return useQuery({
    queryKey: ['pricing-packages'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PricingPackage[]> => {
      const { data, error } = await supabase
        .from('packages')
        .select(
          '*, package_features(included, limit_value, limit_unit, custom_value, sort_order, features(*))',
        )
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['setup_time_standard', 'setup_time_extended', 'support_standard', 'support_extended']);
      const get = (k: string) => settings?.find((r) => r.key === k)?.value ?? null;
      return (data ?? []).map((p) => ({
        ...p,
        setup_time: resolveServiceValue(p.setup_time, get(`setup_time_${p.tier}`)).value,
        support_level: resolveServiceValue(p.support_level, get(`support_${p.tier}`)).value,
        package_features: [...((p as unknown as PricingPackage).package_features ?? [])].sort(
          (a, b) => a.features.sort_order - b.features.sort_order,
        ),
      })) as PricingPackage[];
    },
  });
}

export function formatUsd(value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `$${n.toFixed(2).replace(/\.00$/, '')}`;
}

export function formatMoney(value: number | string, currency: string) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (currency === 'USD') return formatUsd(n);
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

export function validityLabel(pkg: Pick<PackageRow, 'validity_days' | 'event_limit'>) {
  if (!pkg.validity_days) return 'Valid for the event';
  if (pkg.validity_days % 365 === 0) {
    const years = pkg.validity_days / 365;
    return `Valid for ${years === 1 ? '1 year' : `${years} years`}`;
  }
  return `Valid for ${pkg.validity_days} days`;
}

export function eventsLabel(pkg: Pick<PackageRow, 'event_limit'>) {
  return pkg.event_limit === 1 ? '1 event' : `${pkg.event_limit} events`;
}

export function guestsLabel(pkg: Pick<PackageRow, 'guest_limit' | 'event_limit'>) {
  return `Up to ${pkg.guest_limit.toLocaleString()} guests${pkg.event_limit > 1 ? '/event' : ''}`;
}

/** Displayed value for a feature row: configured value, limit, or a plain tick. */
export function featureValue(pf: PackageFeature, pkg?: Pick<PackageRow, 'setup_time' | 'support_level'>) {
  if (pf.features.slug === 'setup-time' && pkg) return pkg.setup_time ?? pf.custom_value ?? null;
  if (pf.features.slug === 'support' && pkg) return pkg.support_level ?? pf.custom_value ?? null;
  if (pf.custom_value) return pf.custom_value;
  if (pf.limit_value) return `Up to ${pf.limit_value.toLocaleString()} ${pf.limit_unit ?? ''}`.trim();
  return null;
}
