-- Fix 1: Allow the group creator to remove members even if their role column
-- says 'admin' — the previous policy only checked cmg_is_admin() which looks at
-- role='admin' in cryptedmessage_group_members. If that row is somehow missing
-- or stale the DELETE was silently blocked with no error returned to the client.
-- Adding the created_by check makes creator removal unconditionally reliable.

DROP POLICY IF EXISTS "group_members_can_leave_or_admin_can_remove" ON cryptedmessage_group_members;

CREATE POLICY "group_members_can_leave_or_admin_can_remove"
    ON cryptedmessage_group_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR cmg_is_admin(group_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM cryptedmessage_groups g
            WHERE g.id = group_id AND g.created_by = auth.uid()
        )
    );

-- Fix 2: REPLICA IDENTITY FULL makes PostgreSQL write the full old row to the
-- WAL on DELETE. Supabase Realtime uses this to match the deleted row against
-- client subscription filters (e.g. user_id=eq.<id>), so removed users receive
-- the DELETE event and their useGroups hook can refresh and hide the group.
ALTER TABLE cryptedmessage_group_members REPLICA IDENTITY FULL;
