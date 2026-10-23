-- Allow global admins to update any profile (required for admin user management UI)
create policy "Admins can update profiles"
on public.profiles
for update
using (public.user_is_global_admin())
with check (public.user_is_global_admin());
