-- Allow global admins to update any profile alongside self-updates
alter policy "profiles_update_own"
on "public"."profiles"
to authenticated
using (
    (uid() = user_id) or public.user_is_global_admin()
)
with check (
    (uid() = user_id) or public.user_is_global_admin()
);
