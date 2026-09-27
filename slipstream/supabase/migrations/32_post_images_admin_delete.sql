-- Admins can delete any post (posts "Authors and admins can delete posts"
-- policy), but when the app also cleans up that post's images from the
-- post-images Storage bucket, the delete call runs as the admin, not the
-- post's own author - the existing "Users can delete their own post
-- images" policy only allows deleting from your own folder, so an admin
-- deleting someone else's post could delete the DB rows but not the
-- underlying files. Let admins delete from any folder in this bucket too.

drop policy "Users can delete their own post images" on storage.objects;

create policy "Users and admins can delete post images"
on storage.objects for delete
using (
  bucket_id = 'post-images'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
