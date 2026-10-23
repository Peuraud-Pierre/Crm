import { supabase } from "@/integrations/supabase/client"
import type { SortingReport } from "@/features/sorters/components/struct"

// Couche service de la feature sorters : seul endroit autorisé à toucher le
// client Supabase (docs/Architecture_Feature.pdf §5).

const SELECT_WITH_PROFILE = `
    *,
    profiles:profiles!sorting_reports_user_id_fkey (
        full_name,
        email,
        avatar_url
    )
`

// Charge les rapports de tri, éventuellement filtrés sur un utilisateur.
export async function fetchSortingReports(
    adminView: boolean,
    userId: string
): Promise<SortingReport[]> {
    let query = supabase
        .from("sorting_reports")
        .select(SELECT_WITH_PROFILE)
        .order("created_at", { ascending: false })

    if (!adminView) query = query.eq("user_id", userId)

    const { data, error } = await query
    if (error) {
        console.error("Erreur chargement :", error)
        return []
    }
    return (data ?? []) as SortingReport[]
}

// Met à jour un rapport existant à partir d'un payload nettoyé (colonnes valides).
export async function updateSortingReport(
    id: string,
    payload: Record<string, string | number>
): Promise<void> {
    const { error } = await supabase
        .from("sorting_reports")
        .update(payload as never)
        .eq("id", id)
        .select()

    if (error) console.error("❌ Error update:", error)
}

// Récupère le rapport de tri lié à une balle donnée.
export async function fetchSortingReportByBalle(
    balleId: string
): Promise<SortingReport | null> {
    const { data, error } = await supabase
        .from("sorting_reports")
        .select("*")
        .eq("uid_balle", balleId)

    if (error) {
        console.error("Error fetching sorting reports:", error)
        return null
    }
    return (data?.[0] as SortingReport) ?? null
}

// Liste les fournisseurs (id + nom) filtrés sur un id donné.
export async function fetchSuppliers(
    supplierId: string
): Promise<{ id: string; name: string | null }[]> {
    const { data, error } = await supabase
        .from("fournisseur")
        .select("id, name")
        .order("name", { ascending: true })
        .eq("id", supplierId)

    if (error) {
        console.error("Erreur chargement fournisseurs :", error)
        return []
    }
    return data ?? []
}

// Abonne aux changements temps réel de la table sorting_reports.
// Retourne une fonction de désabonnement.
export function subscribeSortingReports(
    onChange: (payload: {
        eventType: "INSERT" | "UPDATE" | "DELETE"
        new: SortingReport
        old: SortingReport
    }) => void
): () => void {
    const channel = supabase
        .channel("sorting_reports_realtime")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "sorting_reports" },
            (payload) => {
                onChange({
                    eventType: payload.eventType as
                        | "INSERT"
                        | "UPDATE"
                        | "DELETE",
                    new: payload.new as SortingReport,
                    old: payload.old as SortingReport,
                })
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
