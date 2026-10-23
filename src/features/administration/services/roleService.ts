import { supabase } from "@/integrations/supabase/client"
import type { TablesInsert } from "@/integrations/supabase/types"
import type { EntityOption, Permission, Role } from "../types"

type RawRoleRow = Omit<Role, "permissions"> & {
    roles_permissions: { permission: Permission | null }[]
}

export async function listRoles(): Promise<Role[]> {
    const { data, error } = await supabase
        .from("roles")
        .select(
            "id, nom, created_at, updated_at, roles_permissions(permission:permissions(id, code, label, category))"
        )
        .order("nom")

    if (error) throw error

    return ((data ?? []) as unknown as RawRoleRow[]).map(
        ({ roles_permissions, ...role }) => ({
            ...role,
            permissions: roles_permissions
                .map((rp) => rp.permission)
                .filter((p): p is Permission => p !== null),
        })
    )
}

/** Liste légère (id, nom) pour les selects d'assignation. */
export async function listRoleOptions(): Promise<EntityOption[]> {
    const { data, error } = await supabase
        .from("roles")
        .select("id, nom")
        .order("nom")
    if (error) throw error
    return (data ?? []) as EntityOption[]
}

export async function createRole(nom: string): Promise<Role> {
    const { data, error } = await supabase
        .from("roles")
        .insert([{ nom }] as TablesInsert<"roles">[])
        .select("id, nom, created_at, updated_at")
        .single()

    if (error) throw error
    return { ...(data as Omit<Role, "permissions">), permissions: [] }
}

export async function renameRole(id: string, nom: string): Promise<void> {
    const { data, error } = await supabase
        .from("roles")
        .update({ nom })
        .eq("id", id)
        .select("id")

    if (error) throw error
    if (!data || data.length === 0) throw new Error("Aucune ligne mise à jour")
}

export async function deleteRole(id: string): Promise<void> {
    const { error } = await supabase.from("roles").delete().eq("id", id)
    if (error) throw error
}

export async function addRolePermissions(
    roleId: string,
    permissionIds: string[]
): Promise<void> {
    const rows: TablesInsert<"roles_permissions">[] = permissionIds.map(
        (permission_id) => ({ role_id: roleId, permission_id })
    )
    const { error } = await supabase.from("roles_permissions").insert(rows)
    if (error) throw error
}

export async function removeRolePermission(
    roleId: string,
    permissionId: string
): Promise<void> {
    const { error } = await supabase
        .from("roles_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("permission_id", permissionId)
    if (error) throw error
}
