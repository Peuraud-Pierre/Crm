import { supabase } from "@/integrations/supabase/client"

import type { TablesInsert } from "@/integrations/supabase/types"

export type UserPermissionInsert = TablesInsert<"users_permissions">

/** 🔹 Récupère toutes les permissions */
export async function fetchAllPermissions() {
    return supabase.from("permissions").select("*")
}

/** 🔹 Permissions individuelles d'un utilisateur (avec détail) */
export async function fetchUserIndividualPermissions(userId: string) {
    return supabase
        .from("users_permissions")
        .select(
            "permission_id, permission:permissions(id, code, label, category)"
        )
        .eq("user_id", userId)
}

/** 🔹 Codes des permissions héritées d'un rôle */
export async function fetchRolePermissionCodes(roleId: string) {
    return supabase
        .from("roles_permissions")
        .select("permission:permissions(code)")
        .eq("role_id", roleId)
}

/** 🔹 Codes des permissions héritées d'un service */
export async function fetchServicePermissionCodes(serviceId: string) {
    return supabase
        .from("services_permissions")
        .select("permission:permissions(code)")
        .eq("service_id", serviceId)
}

/** 🔹 Ajoute des permissions individuelles à un utilisateur */
export async function insertUserPermissions(rows: UserPermissionInsert[]) {
    return supabase.from("users_permissions").insert(rows)
}

/** 🔹 Retire une permission individuelle d'un utilisateur */
export async function deleteUserPermission(
    userId: string,
    permissionId: string
) {
    return supabase
        .from("users_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("permission_id", permissionId)
}

/** 🔹 Récupère les profils avec leur service associé */
export async function fetchProfilesWithService() {
    return supabase.from("profiles").select(`
                    user_id,
                    full_name,
                    email,
                    service_id,
                    services:services!profiles_service_id_fkey(nom)
                `)
}
