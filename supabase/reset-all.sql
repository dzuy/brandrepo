delete from storage.objects
where bucket_id = 'brandhub-assets';

truncate table public.brandhub_workspaces restart identity cascade;
truncate table public.brandrepo_integration_access_logs restart identity cascade;
truncate table public.brandrepo_oauth_access_tokens restart identity cascade;
truncate table public.brandrepo_oauth_authorization_codes restart identity cascade;
truncate table public.brandrepo_oauth_clients restart identity cascade;
truncate table public.brandrepo_integration_tokens restart identity cascade;

delete from auth.users;
