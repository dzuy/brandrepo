delete from storage.objects
where bucket_id = 'brandhub-assets';

truncate table public.brandhub_workspaces restart identity cascade;
truncate table public.brandrepo_integration_tokens restart identity cascade;

delete from auth.users;
