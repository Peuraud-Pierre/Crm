// Couche service de la feature dashboard — tables user_dashboard_layout
// et dashboard_layout_templates (docs/Architecture_Feature.pdf §5).
import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import type { DashboardLayout } from "../types/layout.types"

/** Une disposition par défaut, rattachée à un rôle OU à un service. */
export interface LayoutTemplate {
    id: string
    role_id: string | null
    service_id: string | null
    layout: unknown
}

/**
 * Disposition personnelle de l'utilisateur, ou `null` s'il n'en a jamais
 * enregistré — l'absence de ligne est un état valide, il suit alors le
 * gabarit de son rôle (même parti pris que `user_preferences`).
 *
 * La RLS restreint déjà la lecture à sa propre ligne ; le filtre sur
 * `user_id` évite simplement de compter sur elle pour la correction.
 */
export async function fetchUserLayout(userId: string): Promise<unknown | null> {
    const { data, error } = await supabase
        .from("user_dashboard_layout")
        .select("layout")
        .eq("user_id", userId)
        .maybeSingle()

    if (error) throw error
    return data?.layout ?? null
}

export async function saveUserLayout(
    userId: string,
    layout: DashboardLayout
): Promise<void> {
    const { error } = await supabase.from("user_dashboard_layout").upsert(
        // La colonne est un `jsonb`, donc typée `Json` : le cast dit
        // ce que le typage structurel ne peut pas déduire d'un objet
        // dont les clés sont connues.
        { user_id: userId, layout: layout as unknown as Json },
        { onConflict: "user_id" }
    )

    if (error) throw error
}

/**
 * Supprime la disposition personnelle : l'utilisateur retombe sur le
 * gabarit de son rôle. C'est l'implémentation de « Réinitialiser » —
 * on efface plutôt que d'écrire une copie du gabarit, sinon il ne
 * bénéficierait plus des évolutions de celui-ci.
 */
export async function deleteUserLayout(userId: string): Promise<void> {
    const { error } = await supabase
        .from("user_dashboard_layout")
        .delete()
        .eq("user_id", userId)

    if (error) throw error
}

/**
 * Gabarits applicables à l'utilisateur : celui de son rôle et celui de
 * son service. La lecture est ouverte à tout authentifié (le contenu est
 * une disposition d'écran) ; on ne demande que les deux qui le
 * concernent plutôt que la table entière.
 */
export async function fetchTemplatesFor(
    roleId: string | null,
    serviceId: string | null
): Promise<LayoutTemplate[]> {
    const filters: string[] = []
    if (roleId) filters.push(`role_id.eq.${roleId}`)
    if (serviceId) filters.push(`service_id.eq.${serviceId}`)
    if (filters.length === 0) return []

    const { data, error } = await supabase
        .from("dashboard_layout_templates")
        .select("id, role_id, service_id, layout")
        .or(filters.join(","))

    if (error) throw error
    return (data ?? []) as LayoutTemplate[]
}

/* ============================
   Administration des gabarits
============================ */

export async function fetchAllTemplates(): Promise<LayoutTemplate[]> {
    const { data, error } = await supabase
        .from("dashboard_layout_templates")
        .select("id, role_id, service_id, layout")

    if (error) throw error
    return (data ?? []) as LayoutTemplate[]
}

export async function saveTemplate(
    target: { roleId: string } | { serviceId: string },
    layout: DashboardLayout,
    updatedBy: string | null
): Promise<void> {
    const row = {
        role_id: "roleId" in target ? target.roleId : null,
        service_id: "serviceId" in target ? target.serviceId : null,
        layout: layout as unknown as Json,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
    }

    // Les index uniques partiels (un gabarit par rôle, un par service)
    // ne sont pas des contraintes nommées exploitables par `onConflict` :
    // on lit d'abord, puis on insère ou on met à jour.
    const { data: existing, error: readError } = await supabase
        .from("dashboard_layout_templates")
        .select("id")
        .eq(
            "roleId" in target ? "role_id" : "service_id",
            "roleId" in target ? target.roleId : target.serviceId
        )
        .maybeSingle()

    if (readError) throw readError

    const { error } = existing
        ? await supabase
              .from("dashboard_layout_templates")
              .update(row)
              .eq("id", (existing as { id: string }).id)
        : await supabase.from("dashboard_layout_templates").insert(row)

    if (error) throw error
}

export async function deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase
        .from("dashboard_layout_templates")
        .delete()
        .eq("id", id)

    if (error) throw error
}
