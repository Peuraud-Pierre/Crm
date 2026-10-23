import { supabase } from "@/integrations/supabase/client"
import type { FicheAppro } from "@/features/crm/types/client"

/**
 * Une version des infos soumises via une prise de RDV Amelia, archivée par le
 * bridge dans `client_amelia_submissions`. Permet à la fiche client de comparer
 * et restaurer les différentes versions sans perdre l'historique.
 */
export interface AmeliaSubmission {
    id: string
    client_id: string
    event_id: string | null
    submitted_at: string
    full_name: string | null
    societe: string | null
    telephone: string | null
    mail: string | null
    brief: Partial<FicheAppro> | null
}

// La table n'est pas encore dans les types Supabase générés : on cast le client
// pour ce seul appel (même approche que les RPC dans use_client).
type SubmissionsQuery = {
    from: (table: string) => {
        select: (cols: string) => {
            eq: (
                col: string,
                val: string
            ) => {
                order: (
                    col: string,
                    opts: { ascending: boolean }
                ) => Promise<{
                    data: AmeliaSubmission[] | null
                    error: { message: string } | null
                }>
            }
        }
    }
}

export async function fetchAmeliaSubmissions(
    clientId: string
): Promise<AmeliaSubmission[]> {
    const { data, error } = await (supabase as unknown as SubmissionsQuery)
        .from("client_amelia_submissions")
        .select(
            "id, client_id, event_id, submitted_at, full_name, societe, telephone, mail, brief"
        )
        .eq("client_id", clientId)
        .order("submitted_at", { ascending: false })
    if (error) throw error
    return data ?? []
}
