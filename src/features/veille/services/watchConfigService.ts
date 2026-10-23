import { supabase } from "@/integrations/supabase/client"
import type { WatchConfig } from "../types/veille.types"

/**
 * Couche service pour la table `watch_config` (configurations de veille)
 * et la liste des services associables (`services`).
 *
 * Seul ce dossier `services/` est autorisé à importer le client Supabase —
 * les hooks/composants passent par ces fonctions (cf. CLAUDE.md,
 * Architecture_Feature.pdf §5).
 */

export interface ServiceOption {
    id: string
    nom: string
}

/** Liste des services disponibles, triés par nom. */
export const fetchServices = async (): Promise<ServiceOption[]> => {
    const { data, error } = await supabase
        .from("services")
        .select("id, nom")
        .order("nom", { ascending: true })

    if (error) {
        throw new Error(error.message)
    }

    return (data as ServiceOption[]) ?? []
}

/**
 * Configurations actives, éventuellement filtrées par service.
 * Une config est visible si `service_ids` est NULL (toutes) ou contient le service.
 */
export const fetchWatchConfigs = async (
    userServiceId?: string
): Promise<WatchConfig[]> => {
    let query = supabase.from("watch_config").select("*").eq("active", true)

    if (userServiceId) {
        query = query.or(
            `service_ids.is.null,service_ids.cs.{${userServiceId}}`
        )
    }

    const { data, error } = await query.order("created_at", {
        ascending: false,
    })

    if (error) {
        throw new Error(error.message)
    }

    return (data as WatchConfig[]) ?? []
}

export const insertWatchConfig = async (
    config: Omit<WatchConfig, "id" | "created_at">
): Promise<WatchConfig> => {
    const { data, error } = await supabase
        .from("watch_config")
        .insert([config])
        .select()
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return data as WatchConfig
}

export const updateWatchConfig = async (
    id: number,
    config: Partial<Omit<WatchConfig, "id" | "created_at">>
): Promise<WatchConfig> => {
    const { data, error } = await supabase
        .from("watch_config")
        .update(config)
        .eq("id", id)
        .select()
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return data as WatchConfig
}

export const updateWatchConfigServices = async (
    id: number,
    serviceIds: string[] | null
): Promise<void> => {
    const { error } = await supabase
        .from("watch_config")
        .update({ service_ids: serviceIds })
        .eq("id", id)

    if (error) {
        throw new Error(error.message)
    }
}

export const deleteWatchConfig = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from("watch_config")
        .delete()
        .eq("id", id)

    if (error) {
        throw new Error(error.message)
    }
}
