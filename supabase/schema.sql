create table if not exists public.brandhub_workspaces (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brandhub_workspaces_user_id_idx
  on public.brandhub_workspaces (user_id);

alter table public.brandhub_workspaces enable row level security;

drop policy if exists "Users can read their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can read their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can read their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can read their BrandRepo repos"
  on public.brandhub_workspaces
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can create their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can create their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can create their BrandRepo repos"
  on public.brandhub_workspaces
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can update their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can update their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can update their BrandRepo repos"
  on public.brandhub_workspaces
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can delete their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can delete their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can delete their BrandRepo repos"
  on public.brandhub_workspaces
  for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brandhub-assets',
  'brandhub-assets',
  true,
  10485760,
  array[
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/markdown',
    'text/plain',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their BrandHub assets" on storage.objects;
drop policy if exists "Users can read their BrandRepo assets" on storage.objects;
create policy "Users can read their BrandRepo assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'brandhub-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload their BrandHub assets" on storage.objects;
drop policy if exists "Users can upload their BrandRepo assets" on storage.objects;
create policy "Users can upload their BrandRepo assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'brandhub-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their BrandHub assets" on storage.objects;
drop policy if exists "Users can update their BrandRepo assets" on storage.objects;
create policy "Users can update their BrandRepo assets"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'brandhub-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'brandhub-assets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their BrandHub assets" on storage.objects;
drop policy if exists "Users can delete their BrandRepo assets" on storage.objects;
create policy "Users can delete their BrandRepo assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'brandhub-assets' and (storage.foldername(name))[1] = auth.uid()::text);
