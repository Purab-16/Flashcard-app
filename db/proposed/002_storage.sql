-- DRAFT for human review. Not applied. Supabase Storage for uploaded study files.
-- Private bucket, 15 MB limit, files live under "<user_id>/<file>".
-- Policies: select, insert, update for own folder. No delete policy on purpose.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do nothing;

create policy documents_select on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_insert on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_update on storage.objects for update
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
