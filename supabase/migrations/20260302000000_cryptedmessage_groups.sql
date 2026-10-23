-- Group conversations for encrypted messaging
-- Each group has members; messages use chat_id = 'group:<uuid>'

-- Groups table
CREATE TABLE IF NOT EXISTS cryptedmessage_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    avatar_url text,
    created_by uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Group members table
CREATE TABLE IF NOT EXISTS cryptedmessage_group_members (
    group_id uuid NOT NULL REFERENCES cryptedmessage_groups(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at timestamp with time zone DEFAULT now(),
    last_read_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cryptedmessage_group_members_user_id
    ON cryptedmessage_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_cryptedmessage_group_members_group_id
    ON cryptedmessage_group_members(group_id);

-- ============================================================
-- Helper functions with SECURITY DEFINER
-- These bypass RLS when called from within a policy, which
-- breaks the infinite-recursion caused by policies on
-- cryptedmessage_group_members referencing the same table.
-- ============================================================

CREATE OR REPLACE FUNCTION cmg_is_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM cryptedmessage_group_members
        WHERE group_id = p_group_id AND user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION cmg_is_admin(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM cryptedmessage_group_members
        WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
    );
$$;

-- recipient_id is NULL for group messages (no single recipient)
ALTER TABLE cryptedmessage ALTER COLUMN recipient_id DROP NOT NULL;

-- ============================================================
-- Enable RLS
-- ============================================================

ALTER TABLE cryptedmessage_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cryptedmessage_group_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Drop existing policies (idempotent re-run)
-- ============================================================

DROP POLICY IF EXISTS "group_members_can_select_groups"           ON cryptedmessage_groups;
DROP POLICY IF EXISTS "group_creator_can_select_own_groups"       ON cryptedmessage_groups;
DROP POLICY IF EXISTS "authenticated_can_create_groups"           ON cryptedmessage_groups;
DROP POLICY IF EXISTS "group_admin_can_update_group"              ON cryptedmessage_groups;
DROP POLICY IF EXISTS "group_admin_can_delete_group"              ON cryptedmessage_groups;

DROP POLICY IF EXISTS "group_members_can_select_members"          ON cryptedmessage_group_members;
DROP POLICY IF EXISTS "group_admin_or_creator_can_add_members"    ON cryptedmessage_group_members;
DROP POLICY IF EXISTS "group_members_can_update_own_row"          ON cryptedmessage_group_members;
DROP POLICY IF EXISTS "group_members_can_leave_or_admin_can_remove" ON cryptedmessage_group_members;

DROP POLICY IF EXISTS "group_members_can_read_group_messages"     ON cryptedmessage;
DROP POLICY IF EXISTS "group_members_can_insert_group_messages"   ON cryptedmessage;

-- ============================================================
-- RLS policies for cryptedmessage_groups
-- (queries cryptedmessage_group_members via SECURITY DEFINER fn)
-- ============================================================

-- Members can see their groups
CREATE POLICY "group_members_can_select_groups"
    ON cryptedmessage_groups FOR SELECT
    USING (cmg_is_member(id, auth.uid()));

-- Creator can see their group immediately after INSERT (before being added as member)
CREATE POLICY "group_creator_can_select_own_groups"
    ON cryptedmessage_groups FOR SELECT
    USING (auth.uid() = created_by);

CREATE POLICY "authenticated_can_create_groups"
    ON cryptedmessage_groups FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "group_admin_can_update_group"
    ON cryptedmessage_groups FOR UPDATE
    USING (auth.uid() = created_by);

CREATE POLICY "group_admin_can_delete_group"
    ON cryptedmessage_groups FOR DELETE
    USING (auth.uid() = created_by);

-- ============================================================
-- RLS policies for cryptedmessage_group_members
-- All membership checks go through SECURITY DEFINER helpers
-- to avoid infinite recursion.
-- ============================================================

-- Any member of the group can see the full member list
CREATE POLICY "group_members_can_select_members"
    ON cryptedmessage_group_members FOR SELECT
    USING (cmg_is_member(group_id, auth.uid()));

-- Group creator can seed the initial member list (INSERT happens before
-- the creator's own row exists); existing admins can add new members.
CREATE POLICY "group_admin_or_creator_can_add_members"
    ON cryptedmessage_group_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM cryptedmessage_groups g
            WHERE g.id = group_id AND g.created_by = auth.uid()
        )
        OR cmg_is_admin(group_id, auth.uid())
    );

-- Members update their own row (e.g. last_read_at); admins update anyone
CREATE POLICY "group_members_can_update_own_row"
    ON cryptedmessage_group_members FOR UPDATE
    USING (
        user_id = auth.uid()
        OR cmg_is_admin(group_id, auth.uid())
    );

-- Members can leave; admins can remove anyone
CREATE POLICY "group_members_can_leave_or_admin_can_remove"
    ON cryptedmessage_group_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR cmg_is_admin(group_id, auth.uid())
    );

-- ============================================================
-- Extra policies on cryptedmessage for group messages
-- (P2P sender_id/recipient_id policies already exist)
-- ============================================================

CREATE POLICY "group_members_can_read_group_messages"
    ON cryptedmessage FOR SELECT
    USING (
        chat_id LIKE 'group:%'
        AND cmg_is_member(replace(chat_id, 'group:', '')::uuid, auth.uid())
    );

CREATE POLICY "group_members_can_insert_group_messages"
    ON cryptedmessage FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND chat_id LIKE 'group:%'
        AND cmg_is_member(replace(chat_id, 'group:', '')::uuid, auth.uid())
    );

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_cryptedmessage_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cryptedmessage_groups_updated_at ON cryptedmessage_groups;

CREATE TRIGGER cryptedmessage_groups_updated_at
    BEFORE UPDATE ON cryptedmessage_groups
    FOR EACH ROW EXECUTE FUNCTION update_cryptedmessage_groups_updated_at();
