insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'post-media',
  'post-media',
  true,
  104857600,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v',
    'video/mpeg',
    'video/3gpp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read post media" on storage.objects;
create policy "Public can read post media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'post-media');

drop policy if exists "Admins can upload post media" on storage.objects;
create policy "Admins can upload post media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'post-media' and public.is_admin());

drop policy if exists "Admins can update post media" on storage.objects;
create policy "Admins can update post media"
on storage.objects
for update
to authenticated
using (bucket_id = 'post-media' and public.is_admin())
with check (bucket_id = 'post-media' and public.is_admin());

drop policy if exists "Admins can delete post media" on storage.objects;
create policy "Admins can delete post media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'post-media' and public.is_admin());
