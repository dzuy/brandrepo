create table if not exists public.brandhub_workspaces (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid,
  name text not null,
  data jsonb not null,
  account_slug text,
  repo_slug text,
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brandrepo_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brandrepo_account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.brandrepo_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create table if not exists public.brandrepo_account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.brandrepo_accounts(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.brandhub_workspaces
  add column if not exists account_slug text;

alter table public.brandhub_workspaces
  add column if not exists repo_slug text;

alter table public.brandhub_workspaces
  add column if not exists visibility text not null default 'public';

alter table public.brandhub_workspaces
  add column if not exists account_id uuid references public.brandrepo_accounts(id) on delete cascade;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brandhub_workspaces_visibility_check'
  ) then
    alter table public.brandhub_workspaces
      add constraint brandhub_workspaces_visibility_check
      check (visibility in ('public', 'unlisted', 'private'));
  end if;
end $$;

create index if not exists brandhub_workspaces_user_id_idx
  on public.brandhub_workspaces (user_id);

create index if not exists brandhub_workspaces_account_id_idx
  on public.brandhub_workspaces (account_id);

create index if not exists brandhub_workspaces_public_slug_idx
  on public.brandhub_workspaces (account_slug, repo_slug, updated_at desc)
  where visibility = 'public';

create index if not exists brandrepo_accounts_slug_idx
  on public.brandrepo_accounts (slug);

create index if not exists brandrepo_account_memberships_user_id_idx
  on public.brandrepo_account_memberships (user_id);

create index if not exists brandrepo_account_memberships_account_id_idx
  on public.brandrepo_account_memberships (account_id);

create index if not exists brandrepo_account_invites_account_id_idx
  on public.brandrepo_account_invites (account_id, created_at desc);

create index if not exists brandrepo_account_invites_email_idx
  on public.brandrepo_account_invites (lower(email));

create table if not exists public.brandrepo_integration_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['repo:read', 'assets:read'],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists brandrepo_integration_tokens_user_id_idx
  on public.brandrepo_integration_tokens (user_id);

create index if not exists brandrepo_integration_tokens_token_hash_idx
  on public.brandrepo_integration_tokens (token_hash);

create table if not exists public.brandrepo_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  client_name text not null,
  redirect_uris text[] not null,
  grant_types text[] not null default array['authorization_code', 'refresh_token'],
  response_types text[] not null default array['code'],
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now()
);

create index if not exists brandrepo_oauth_clients_client_id_idx
  on public.brandrepo_oauth_clients (client_id);

create table if not exists public.brandrepo_oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.brandrepo_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  scopes text[] not null default array['repo:read', 'assets:read'],
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brandrepo_oauth_authorization_codes_code_hash_idx
  on public.brandrepo_oauth_authorization_codes (code_hash);

create index if not exists brandrepo_oauth_authorization_codes_user_id_idx
  on public.brandrepo_oauth_authorization_codes (user_id, created_at desc);

create table if not exists public.brandrepo_oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.brandrepo_oauth_clients(client_id) on delete cascade,
  access_token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['repo:read', 'assets:read'],
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  refresh_token_hash text unique,
  refresh_token_expires_at timestamptz
);

create index if not exists brandrepo_oauth_access_tokens_user_id_idx
  on public.brandrepo_oauth_access_tokens (user_id, created_at desc);

create index if not exists brandrepo_oauth_access_tokens_access_token_hash_idx
  on public.brandrepo_oauth_access_tokens (access_token_hash);

create index if not exists brandrepo_oauth_access_tokens_refresh_token_hash_idx
  on public.brandrepo_oauth_access_tokens (refresh_token_hash);

create table if not exists public.brandrepo_integration_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_token_id uuid references public.brandrepo_integration_tokens(id) on delete set null,
  method text not null,
  path text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists brandrepo_integration_access_logs_user_id_idx
  on public.brandrepo_integration_access_logs (user_id, created_at desc);

create index if not exists brandrepo_integration_access_logs_token_id_idx
  on public.brandrepo_integration_access_logs (integration_token_id, created_at desc);

create table if not exists public.brandrepo_external_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  code_verifier text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brandrepo_external_oauth_states_state_idx
  on public.brandrepo_external_oauth_states (state);

create index if not exists brandrepo_external_oauth_states_user_id_idx
  on public.brandrepo_external_oauth_states (user_id, created_at desc);

create table if not exists public.brandrepo_external_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_label text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_type text not null default 'Bearer',
  scopes text[] not null default array[]::text[],
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, provider)
);

create index if not exists brandrepo_external_connections_user_id_idx
  on public.brandrepo_external_connections (user_id, connected_at desc);

create index if not exists brandrepo_external_connections_provider_idx
  on public.brandrepo_external_connections (provider);

alter table public.brandhub_workspaces enable row level security;
alter table public.brandrepo_accounts enable row level security;
alter table public.brandrepo_account_memberships enable row level security;
alter table public.brandrepo_account_invites enable row level security;
alter table public.brandrepo_integration_tokens enable row level security;
alter table public.brandrepo_oauth_clients enable row level security;
alter table public.brandrepo_oauth_authorization_codes enable row level security;
alter table public.brandrepo_oauth_access_tokens enable row level security;
alter table public.brandrepo_integration_access_logs enable row level security;
alter table public.brandrepo_external_oauth_states enable row level security;
alter table public.brandrepo_external_connections enable row level security;

create or replace function public.brandrepo_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'dzuylinh@gmail.com';
$$;

create or replace function public.brandrepo_is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.brandrepo_is_platform_admin()
    or exists (
      select 1
      from public.brandrepo_account_memberships membership
      where membership.account_id = target_account_id
        and membership.user_id = auth.uid()
    );
$$;

create or replace function public.brandrepo_can_edit_account(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.brandrepo_is_platform_admin()
    or exists (
      select 1
      from public.brandrepo_account_memberships membership
      where membership.account_id = target_account_id
        and membership.user_id = auth.uid()
        and membership.role in ('owner', 'admin', 'editor')
    );
$$;

drop policy if exists "Users can read their BrandRepo accounts" on public.brandrepo_accounts;
create policy "Users can read their BrandRepo accounts"
  on public.brandrepo_accounts
  for select
  using (public.brandrepo_is_account_member(id));

drop policy if exists "Platform admin can create BrandRepo accounts" on public.brandrepo_accounts;
create policy "Platform admin can create BrandRepo accounts"
  on public.brandrepo_accounts
  for insert
  with check (public.brandrepo_is_platform_admin());

drop policy if exists "Platform admin can update BrandRepo accounts" on public.brandrepo_accounts;
create policy "Platform admin can update BrandRepo accounts"
  on public.brandrepo_accounts
  for update
  using (public.brandrepo_is_platform_admin())
  with check (public.brandrepo_is_platform_admin());

drop policy if exists "Users can read their BrandRepo account memberships" on public.brandrepo_account_memberships;
create policy "Users can read their BrandRepo account memberships"
  on public.brandrepo_account_memberships
  for select
  using (public.brandrepo_is_account_member(account_id));

drop policy if exists "Platform admin can manage BrandRepo account memberships" on public.brandrepo_account_memberships;
create policy "Platform admin can manage BrandRepo account memberships"
  on public.brandrepo_account_memberships
  for all
  using (public.brandrepo_is_platform_admin())
  with check (public.brandrepo_is_platform_admin());

drop policy if exists "Account admins can read BrandRepo account invites" on public.brandrepo_account_invites;
create policy "Account admins can read BrandRepo account invites"
  on public.brandrepo_account_invites
  for select
  using (public.brandrepo_can_edit_account(account_id));

drop policy if exists "Platform admin can manage BrandRepo account invites" on public.brandrepo_account_invites;
create policy "Platform admin can manage BrandRepo account invites"
  on public.brandrepo_account_invites
  for all
  using (public.brandrepo_is_platform_admin())
  with check (public.brandrepo_is_platform_admin());

drop policy if exists "Users can read their BrandRepo external OAuth states" on public.brandrepo_external_oauth_states;
create policy "Users can read their BrandRepo external OAuth states"
  on public.brandrepo_external_oauth_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their BrandRepo external connections" on public.brandrepo_external_connections;
create policy "Users can read their BrandRepo external connections"
  on public.brandrepo_external_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can revoke their BrandRepo external connections" on public.brandrepo_external_connections;
create policy "Users can revoke their BrandRepo external connections"
  on public.brandrepo_external_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read OAuth clients" on public.brandrepo_oauth_clients;
create policy "Users can read OAuth clients"
  on public.brandrepo_oauth_clients
  for select
  using (true);

drop policy if exists "Users can read their BrandRepo OAuth authorization codes" on public.brandrepo_oauth_authorization_codes;
create policy "Users can read their BrandRepo OAuth authorization codes"
  on public.brandrepo_oauth_authorization_codes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their BrandRepo OAuth access tokens" on public.brandrepo_oauth_access_tokens;
create policy "Users can read their BrandRepo OAuth access tokens"
  on public.brandrepo_oauth_access_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can revoke their BrandRepo OAuth access tokens" on public.brandrepo_oauth_access_tokens;
create policy "Users can revoke their BrandRepo OAuth access tokens"
  on public.brandrepo_oauth_access_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their BrandRepo integration access logs" on public.brandrepo_integration_access_logs;
create policy "Users can read their BrandRepo integration access logs"
  on public.brandrepo_integration_access_logs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their BrandRepo integration tokens" on public.brandrepo_integration_tokens;
create policy "Users can read their BrandRepo integration tokens"
  on public.brandrepo_integration_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their BrandRepo integration tokens" on public.brandrepo_integration_tokens;
create policy "Users can create their BrandRepo integration tokens"
  on public.brandrepo_integration_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can revoke their BrandRepo integration tokens" on public.brandrepo_integration_tokens;
create policy "Users can revoke their BrandRepo integration tokens"
  on public.brandrepo_integration_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can read their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can read their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can read their BrandRepo repos"
  on public.brandhub_workspaces
  for select
  using (auth.uid() = user_id or public.brandrepo_is_account_member(account_id));

drop policy if exists "Anyone can read public BrandRepo repos" on public.brandhub_workspaces;
create policy "Anyone can read public BrandRepo repos"
  on public.brandhub_workspaces
  for select
  using (visibility = 'public');

drop policy if exists "Users can create their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can create their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can create their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can create their BrandRepo repos"
  on public.brandhub_workspaces
  for insert
  with check (auth.uid() = user_id or public.brandrepo_can_edit_account(account_id));

drop policy if exists "Users can update their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can update their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can update their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can update their BrandRepo repos"
  on public.brandhub_workspaces
  for update
  using (auth.uid() = user_id or public.brandrepo_can_edit_account(account_id))
  with check (auth.uid() = user_id or public.brandrepo_can_edit_account(account_id));

drop policy if exists "Users can delete their BrandHub workspaces" on public.brandhub_workspaces;
drop policy if exists "Users can delete their BrandHub repos" on public.brandhub_workspaces;
drop policy if exists "Users can delete their BrandRepo repos" on public.brandhub_workspaces;
create policy "Users can delete their BrandRepo repos"
  on public.brandhub_workspaces
  for delete
  using (auth.uid() = user_id or public.brandrepo_can_edit_account(account_id));

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
