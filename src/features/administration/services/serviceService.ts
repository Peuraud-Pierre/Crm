import { supabase } from "@/integrations/supabase/client"
import type { TablesInsert } from "@/integrations/supabase/types"
import type { EntityOption, Permission, Service } from "../types"

type RawServiceRow = Omit<Service, "permissions"> & {
    services_permissions: { permission: Permission | null }[]
}

export async function listServices(): Promise<Service[]> {
    const { data, error } = await supabase
        .from("services")
        .select(
            "id, nom, created_at, updated_at, services_permissions(permission:permissions(id, code, label, category))"
        )
        .order("nom")

    if (error) throw error

    return ((data ?? []) as unknown as RawServiceRow[]).map(
        ({ services_permissions, ...service }) => ({
            ...service,
            permissions: services_permissions
                .map((sp) => sp.permission)
                .filter((p): p is Permission => p !== null),
        })
    )
}

/** Liste légère (id, nom) pour les selects d'assignation. */
export async function listServiceOptions(): Promise<EntityOption[]> {
    const { data, error } = await supabase
        .from("services")
        .select("id, nom")
        .order("nom")
    if (error) throw error
    return (data ?? []) as EntityOption[]
}

export async function createService(nom: string): Promise<Service> {
    const { data, error } = await supabase
        .from("services")
        .insert([{ nom }] as TablesInsert<"services">[])
        .select("id, nom, created_at, updated_at")
        .single()

    if (error) throw error
    return { ...(data as Omit<Service, "permissions">), permissions: [] }
}

export async function renameService(id: string, nom: string): Promise<void> {
    const { data, error } = await supabase
        .from("services")
        .update({ nom })
        .eq("id", id)
        .select("id")

    if (error) throw error
    if (!data || data.length === 0) throw new Error("Aucune ligne mise à jour")
}

export async function deleteService(id: string): Promise<void> {
    const { error } = await supabase.from("services").delete().eq("id", id)
    if (error) throw error
}

export async function addServicePermissions(
    serviceId: string,
    permissionIds: string[]
): Promise<void> {
    const rows: TablesInsert<"services_permissions">[] = permissionIds.map(
        (permission_id) => ({ service_id: serviceId, permission_id })
    )
    const { error } = await supabase.from("services_permissions").insert(rows)
    if (error) throw error
}

export async function removeServicePermission(
    serviceId: string,
    permissionId: string
): Promise<void> {
    const { error } = await supabase
        .from("services_permissions")
        .delete()
        .eq("service_id", serviceId)
        .eq("permission_id", permissionId)
    if (error) throw error
}
