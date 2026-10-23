// Couche service de la feature maintenance — table public.app_maintenance
// (docs/Architecture_Feature.pdf §5). Seul endroit de la feature autorisé à
// importer le client Supabase.
import { supabase } from "@/integrations/supabase/client"
import type {
    MaintenanceDraft,
    MaintenanceUpdate,
    MaintenanceWindow,
} from "../types/maintenance.types"

/**
 * Toutes les fenêtres de maintenance (globale + par feature).
 *
 * La RLS ouvre la lecture à tout utilisateur authentifié : l'écran de
 * maintenance et le compte à rebours du header doivent s'afficher pour
 * ceux qui sont justement privés d'accès.
 */
export async function fetchMaintenanceWindows(): Promise<MaintenanceWindow[]> {
    const { data, error } = await supabase
        .from("app_maintenance")
        .select("*")
        .order("starts_at", { ascending: true })

    if (error) throw error
    return (data ?? []) as MaintenanceWindow[]
}

export async function insertMaintenanceWindow(
    draft: MaintenanceDraft
): Promise<MaintenanceWindow> {
    const { data, error } = await supabase
        .from("app_maintenance")
        .insert({
            scope: draft.scope,
            feature_key: draft.scope === "feature" ? draft.feature_key : null,
            active: draft.active ?? false,
            starts_at: draft.starts_at,
            ends_at: draft.ends_at ?? null,
            message: draft.message ?? null,
        })
        .select()
        .single()

    if (error) throw error
    return data as MaintenanceWindow
}

export async function updateMaintenanceWindow(
    id: string,
    updates: MaintenanceUpdate
): Promise<MaintenanceWindow> {
    const { data, error } = await supabase
        .from("app_maintenance")
        .update(updates)
        .eq("id", id)
        .select()
        .single()

    if (error) throw error
    return data as MaintenanceWindow
}

export async function deleteMaintenanceWindow(id: string): Promise<void> {
    const { error } = await supabase
        .from("app_maintenance")
        .delete()
        .eq("id", id)

    if (error) throw error
}
