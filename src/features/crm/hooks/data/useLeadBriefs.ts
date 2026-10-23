import { useEffect, useState } from "react"
import * as clientService from "@/features/crm/services/clientService"

const EMPTY: unknown[] = []

/**
 * Briefs des leads entrants (clients créés dans [start, end[), filtrés comme
 * le KPI « Leads » de l'Analytics. `start`/`end` à null → aucune requête.
 */
export function useLeadBriefs(
    start: string | null,
    end: string | null,
    userId: string | null
) {
    // Résultat indexé par ses paramètres : tant que la requête des nouveaux
    // paramètres n'a pas répondu, on renvoie une liste vide plutôt que les
    // briefs d'une autre période.
    const key = start && end ? `${start}|${end}|${userId ?? ""}` : null
    const [result, setResult] = useState<{ key: string; briefs: unknown[] }>()

    useEffect(() => {
        if (!start || !end || !key) return
        let cancelled = false
        clientService
            .fetchClientBriefsCreatedBetween(start, end, userId)
            .then((rows) => {
                if (!cancelled)
                    setResult({ key, briefs: rows.map((r) => r.brief) })
            })
            .catch((error) => {
                // Sans briefs, tous les leads tombent en « Non renseigné » :
                // on le signale plutôt que d'échouer en silence.
                console.error(
                    "[useLeadBriefs] lecture des briefs impossible",
                    error
                )
            })
        return () => {
            cancelled = true
        }
    }, [start, end, userId, key])

    return result && result.key === key ? result.briefs : EMPTY
}
