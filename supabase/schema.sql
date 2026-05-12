create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 20000),
  author_id uuid default auth.uid() references auth.users(id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

alter table public.admin_users enable row level security;
alter table public.posts enable row level security;
alter table public.subscribers enable row level security;

grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert on public.subscribers to anon, authenticated;
grant select on public.admin_users to authenticated;

drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
on public.posts
for select
to anon, authenticated
using (published_at is not null or public.is_admin());

drop policy if exists "Admins can insert posts" on public.posts;
create policy "Admins can insert posts"
on public.posts
for insert
to authenticated
with check (public.is_admin() and author_id = auth.uid());

drop policy if exists "Admins can update posts" on public.posts;
create policy "Admins can update posts"
on public.posts
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete posts" on public.posts;
create policy "Admins can delete posts"
on public.posts
for delete
to authenticated
using (public.is_admin());

drop policy if exists "Users can check own admin status" on public.admin_users;
create policy "Users can check own admin status"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Anyone can subscribe" on public.subscribers;
create policy "Anyone can subscribe"
on public.subscribers
for insert
to anon, authenticated
with check (true);

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

insert into public.posts (title, body, published_at)
values
  ('시작', '무언가를 오래 남기기 위해 많은 형식이 필요하지는 않다.

이곳에는 생각이 지나간 자리만 간단히 적어둔다.', '2026-05-12 00:00:00+00'),
  ('작은 기록', '기록은 완성된 글이 아니어도 된다.

당시의 감각을 잃지 않을 정도면 충분하다.', '2026-05-10 00:00:00+00'),
  ('비워두기', '화면에 무언가를 더하는 일은 쉽다.

덜어내고도 필요한 것이 남아 있는지 확인하는 일은 조금 더 어렵다.', '2026-05-08 00:00:00+00')
on conflict do nothing;
