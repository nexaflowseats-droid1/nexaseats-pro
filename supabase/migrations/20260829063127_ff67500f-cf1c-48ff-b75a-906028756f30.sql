create policy "docs read" on storage.objects for select to authenticated using (bucket_id in ('event-documents','event-images'));
create policy "docs insert" on storage.objects for insert to authenticated with check (bucket_id in ('event-documents','event-images'));
create policy "docs update" on storage.objects for update to authenticated using (bucket_id in ('event-documents','event-images')) with check (bucket_id in ('event-documents','event-images'));
create policy "docs delete" on storage.objects for delete to authenticated using (bucket_id in ('event-documents','event-images'));