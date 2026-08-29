revoke execute on function public.is_org_member(uuid) from anon, authenticated, public;
revoke execute on function public.has_org_role(uuid, public.org_role) from anon, authenticated, public;
revoke execute on function public.can_access_event(uuid) from anon, authenticated, public;