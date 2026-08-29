grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role) to authenticated;
grant execute on function public.can_access_event(uuid) to authenticated;