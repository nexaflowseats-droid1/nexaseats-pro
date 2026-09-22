// Server-only payment provider integration. The provider is never named in the UI.
import { supabaseAdmin } from '@/integrations/supabase/client.server';

type ProviderResult = {
  ok: boolean;
  status: string;
  transactionUuid?: string | null;
  providerTransactionId?: string | null;
  redirectUrl?: string | null;
  message?: string;
  raw: unknown;
};

function credentials() {
  const key = process.env['MARZPAY_API_KEY'];
  const secret = process.env['MARZPAY_API_SECRET'];
  const base = process.env['MARZPAY_BASE_URL'] ?? 'https://wallet.wearemarz.com/api/v1';
  if (!key || !secret) throw new Error('Payments are not configured yet.');
  const token = btoa(`${key}:${secret}`);
  return { token, base };
}

async function providerRequest(path: string, init?: RequestInit) {
  const { token, base } = credentials();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ?? `Payment request failed (${res.status})`;
    throw new Error(message);
  }
  return body as Record<string, any>;
}

/** Normalises every provider status into our four internal states. */
export function normaliseStatus(raw: string | null | undefined) {
  const s = (raw ?? '').toLowerCase();
  if (['completed', 'success', 'successful', 'paid', 'sandbox'].includes(s)) return 'successful';
  if (['failed', 'declined', 'rejected', 'error', 'expired'].includes(s)) return 'failed';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['processing', 'pending', 'initiated', 'sent'].includes(s)) return 'processing';
  return 'processing';
}

export async function createCollection(input: {
  amount: number;
  reference: string;
  method: 'mobile_money' | 'card';
  phoneNumber?: string | null;
  country: string;
  currency?: string | null;
  description: string;
  callbackUrl: string;
}): Promise<ProviderResult> {
  const payload: Record<string, unknown> = {
    amount: input.amount,
    reference: input.reference,
    country: input.country,
    method: input.method,
    description: input.description.slice(0, 255),
    callback_url: input.callbackUrl.slice(0, 255),
  };
  if (input.currency) payload['currency'] = input.currency;
  if (input.method === 'mobile_money') payload['phone_number'] = input.phoneNumber;

  const body = await providerRequest('/collect-money', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const tx = body?.['data']?.['transaction'] ?? {};
  return {
    ok: (body?.['status'] ?? 'success') === 'success',
    status: normaliseStatus(tx?.['status']),
    transactionUuid: tx?.['uuid'] ?? null,
    redirectUrl: body?.['data']?.['redirect_url'] ?? null,
    message: body?.['message'],
    raw: body,
  };
}

export async function fetchCollection(uuidOrReference: string): Promise<ProviderResult> {
  const body = await providerRequest(`/collect-money/${uuidOrReference}`);
  const data = body?.['data'] ?? {};
  const tx = data?.['transaction'] ?? data?.['collection'] ?? data;
  return {
    ok: true,
    status: normaliseStatus(tx?.['status']),
    transactionUuid: tx?.['uuid'] ?? null,
    providerTransactionId:
      data?.['collection']?.['provider_transaction_id'] ?? tx?.['provider_transaction_id'] ?? null,
    raw: body,
  };
}

/**
 * Applies a verified provider outcome to a payment + its order.
 * Idempotent: credits are granted at most once per order.
 */
export async function settlePayment(paymentId: string, result: ProviderResult) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, orders(*)')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) return { status: 'unknown' as const };

  const order = (payment as any).orders as {
    id: string;
    user_id: string;
    organization_id: string | null;
    package_id: string;
    status: string;
    credits_granted: boolean;
  } | null;

  const status = result.status;
  const now = new Date().toISOString();

  await supabaseAdmin
    .from('payments')
    .update({
      status: status === 'successful' ? 'successful' : status,
      provider_transaction_uuid: result.transactionUuid ?? payment.provider_transaction_uuid,
      provider_transaction_id: result.providerTransactionId ?? payment.provider_transaction_id,
      callback_received_at: now,
      ...(status === 'successful' ? { paid_at: now } : {}),
      ...(status === 'failed' ? { failure_reason: result.message ?? 'Payment was not completed' } : {}),
      metadata: (result.raw ?? {}) as never,
    })
    .eq('id', paymentId);

  if (!order) return { status };

  if (status === 'successful') {
    if (order.status !== 'paid') {
      await supabaseAdmin.from('orders').update({ status: 'paid', paid_at: now }).eq('id', order.id);
    }
    if (!order.credits_granted) {
      const { data: pkg } = await supabaseAdmin
        .from('packages')
        .select('event_limit, guest_limit, validity_days')
        .eq('id', order.package_id)
        .maybeSingle();
      if (pkg) {
        const expires = pkg.validity_days
          ? new Date(Date.now() + pkg.validity_days * 86400000).toISOString()
          : null;
        const { error } = await supabaseAdmin.from('event_credits').insert({
          organization_id: order.organization_id,
          user_id: order.user_id,
          order_id: order.id,
          package_id: order.package_id,
          credits_total: pkg.event_limit,
          guest_limit: pkg.guest_limit,
          expires_at: expires,
        });
        // A unique constraint on order_id guarantees credits are never granted twice.
        if (!error) {
          await supabaseAdmin.from('orders').update({ credits_granted: true }).eq('id', order.id);
        }
      }
    }
  } else if (status === 'failed' || status === 'cancelled') {
    if (order.status === 'pending') {
      await supabaseAdmin.from('orders').update({ status }).eq('id', order.id);
    }
  }

  return { status };
}

/** Re-checks a payment with the provider and settles it. Never trusts the browser. */
export async function verifyAndSettle(paymentId: string) {
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, status, provider_reference, provider_transaction_uuid')
    .eq('id', paymentId)
    .maybeSingle();
  if (!payment) return { status: 'unknown' as const };
  if (payment.status === 'successful') return { status: 'successful' as const };

  const lookup = payment.provider_transaction_uuid ?? payment.provider_reference;
  if (!lookup) return { status: payment.status };
  try {
    const result = await fetchCollection(lookup);
    const settled = await settlePayment(payment.id, result);
    return settled;
  } catch (err) {
    console.error('[payments] verification failed', err);
    return { status: payment.status };
  }
}
