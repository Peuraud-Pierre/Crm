// Référentiels rôles / services, pour les écrans qui doivent désigner un
// public : ciblage d'une annonce, gabarit de dashboard.
//
// Partagé plutôt que dupliqué (réutilisation prouvée dans deux features,
// règle de promotion du design system §4), et lu ici plutôt qu'importé de
// `features/administration` : une feature ne consomme pas les internes
// d'une autre.
import { supabase } from "@/integrations/supabase/client"

/** Un rôle ou un service, réduit à ce qu'un sélecteur affiche. */
export interface AudienceOption {
    id: string
    nom: string
}

/**
 * La lecture de ces deux référentiels est ouverte à tout utilisateur
 * authentifié (policies « Users can view all roles/services »), et les
 * écrans qui s'en servent sont de toute façon gatés par leur propre
 * permission.
 */
export async function fetchAudienceOptions(): Promise<{
    roles: AudienceOption[]
    services: AudienceOption[]
}> {
    const [roles, services] = await Promise.all([
        supabase.from("roles").select("id, nom").order("nom"),
        supabase.from("services").select("id, nom").order("nom"),
    ])

    if (roles.error) throw roles.error
    if (services.error) throw services.error

    return {
        roles: (roles.data ?? []) as AudienceOption[],
        services: (services.data ?? []) as AudienceOption[],
    }
}
