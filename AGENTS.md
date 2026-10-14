<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Receipts/emails run only after server-verified payment via `afterPaymentSettled` in `src/lib/receipts.server.ts`; all steps idempotent (unique order_id on receipts, one 'initial' email per receipt) so webhook retries never duplicate credits or emails.
- Package setup time/support: per-package column overrides tier default stored in app_settings; resolve with `resolveServiceValue` in `src/lib/billing.ts` (pure, unit-tested).
- Admin-only operations check `has_role(admin)` server-side in `src/lib/billing.functions.ts`; the UI check is cosmetic.
