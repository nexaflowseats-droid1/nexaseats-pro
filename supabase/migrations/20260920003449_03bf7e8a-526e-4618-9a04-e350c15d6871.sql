CREATE POLICY "org members read generated pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-pdfs' AND public.is_org_member(((storage.foldername(name))[1])::uuid));

CREATE POLICY "org members create generated pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-pdfs' AND public.is_org_member(((storage.foldername(name))[1])::uuid));

CREATE POLICY "org members delete generated pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-pdfs' AND public.is_org_member(((storage.foldername(name))[1])::uuid));