import { supabase } from "@/integrations/supabase/client"
import type { TablesInsert } from "@/integrations/supabase/types"
import type {
    Permission,
    PermissionAssignments,
    UserPermissions,
} from "../types"

export async function listPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
        .from("permissions")
        .select("id, code, label, category")
        .order("category")
        .order("label")

    if (error) throw error
    return (data ?? []) as Permission[]
}

type HolderRow = { permission_id: string; holder: { id: string; nom: string } | null }

/** Vue d'audit : pour chaque permission, quels rôles/services la détiennent
 *  et combien d'utilisateurs l'ont en individuel. */
export async function listPermissionAssignments(): Promise<PermissionAssignments> {
    const [rolesRes, servicesRes, usersRes] = await Promise.all([
        supabase
            .from("roles_permissions")
            .select("permission_id, holder:roles(id, nom)"),
        supabase
            .from("services_permissions")
            .select("permission_id, holder:services(id, nom)"),
        supabase.from("users_permissions").select("permission_id"),
    ])

    const firstError = rolesRes.error ?? servicesRes.error ?? usersRes.error
    if (firstError) throw firstError

    const assignments: PermissionAssignments = new Map()
    const entry = (permissionId: string) => {
        let e = assignments.get(permissionId)
        if (!e) {
            e = { roles: [], services: [], userCount: 0 }
            assignments.set(permissionId, e)
        }
        return e
    }

    for (const row of (rolesRes.data ?? []) as unknown as HolderRow[]) {
        if (row.holder) entry(row.permission_id).roles.push(row.holder)
    }
    for (const row of (servicesRes.data ?? []) as unknown as HolderRow[]) {
        if (row.holder) entry(row.permission_id).services.push(row.holder)
    }
    for (const row of usersRes.data ?? []) {
        entry(row.permission_id).userCount += 1
    }

    return assignments
}

/** Permissions individuelles d'un utilisateur + codes hérités de son rôle/service. */
export async function listUserPermissions(
    userId: string,
    roleId: string | null,
    serviceId: string | null
): Promise<UserPermissions> {
    const [individualRes, rolePermsRes, servicePermsRes] = await Promise.all([
        supabase
            .from("users_permissions")
            .select("permission:permissions(id, code, label, category)")
            .eq("user_id", userId),
        roleId
            ? supabase
                  .from("roles_permissions")
                  .select("permission:permissions(code)")
                  .eq("role_id", roleId)
            : Promise.resolve({ data: [], error: null }),
        serviceId
            ? supabase
                  .from("services_permissions")
                  .select("permission:permissions(code)")
                  .eq("service_id", serviceId)
            : Promise.resolve({ data: [], error: null }),
    ])

    const firstError =
        individualRes.error ?? rolePermsRes.error ?? servicePermsRes.error
    if (firstError) throw firstError

    const inheritedCodes = new Set<string>()
    type CodeRow = { permission: { code: string } | null }
    for (const row of (rolePermsRes.data ?? []) as CodeRow[]) {
        if (row.permission?.code) inheritedCodes.add(row.permission.code)
    }
    for (const row of (servicePermsRes.data ?? []) as CodeRow[]) {
        if (row.permission?.code) inheritedCodes.add(row.permission.code)
    }

    const individual = ((individualRes.data ?? []) as unknown as {
        permission: Permission | null
    }[])
        .map((row) => row.permission)
        .filter((p): p is Permission => p !== null)

    return { individual, inheritedCodes }
}

export async function addUserPermissions(
    userId: string,
    permissionIds: string[]
): Promise<void> {
    const rows: TablesInsert<"users_permissions">[] = permissionIds.map(
        (permission_id) => ({ user_id: userId, permission_id })
    )
    const { error } = await supabase.from("users_permissions").insert(rows)
    if (error) throw error
}

export async function removeUserPermission(
    userId: string,
    permissionId: string
): Promise<void> {
    const { error } = await supabase
        .from("users_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("permission_id", permissionId)
    if (error) throw error
}
