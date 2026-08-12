delete from storage.objects
where bucket_id = 'brandhub-assets';

truncate table public.brandhub_workspaces restart identity cascade;

delete from auth.users;
