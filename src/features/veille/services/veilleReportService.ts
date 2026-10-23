import { supabase } from "@/integrations/supabase/client"

/**
 * Couche service pour la table `ai_watch_reports` (rapports de veille)
 * et la RPC `get_visible_watch_reports`.
 *
 * Seul ce dossier `services/` est autorisé à importer le client Supabase —
 * les hooks/composants passent par ces fonctions (cf. CLAUDE.md,
 * Architecture_Feature.pdf §5).
 */

/**
 * Tous les rapports (admin uniquement — la RLS protège l'accès),
 * éventuellement limités à une date de début.
 */
export const fetchAllReports = async (dateStart: string | null) => {
    let query = supabase
        .from("ai_watch_reports")
        .select("*")
        .order("created_at", { ascending: false })

    if (dateStart) {
        query = query.gte("created_at", dateStart)
    }

    const { data, error } = await query

    if (error) {
        throw new Error(error.message)
    }

    return data
}

/**
 * Rapports visibles pour un service donné, filtrés côté base via la RPC
 * `get_visible_watch_reports` (source de vérité de la visibilité).
 */
export const fetchVisibleReports = async (serviceId: string) => {
    const { data, error } = await supabase.rpc("get_visible_watch_reports", {
        p_service_id: serviceId,
    })

    if (error) {
        throw new Error(error.message)
    }

    return data
}

/**
 * Dernier rapport généré pour une configuration (par nom de topic).
 * Retourne null si aucun rapport n'existe (code PGRST116 = zéro ligne).
 */
export const fetchLatestReport = async (configName: string) => {
    const { data, error } = await supabase
        .from("ai_watch_reports")
        .select("*")
        .eq("topic", configName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

    if (error && error.code !== "PGRST116") {
        throw new Error(error.message)
    }

    return data ?? null
}

/** Suppression d'un rapport (admin). */
export const deleteReport = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from("ai_watch_reports")
        .delete()
        .eq("id", id)

    if (error) {
        throw new Error(error.message)
    }
}
