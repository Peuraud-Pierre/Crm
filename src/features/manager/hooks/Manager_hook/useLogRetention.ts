import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
    fetchRetentionAudit,
    purgeOldAppLogs,
} from "@/features/manager/services/logRetentionService"

/** Durée de conservation des logs applicatifs avant suppression automatique. */
export const LOG_RETENTION_MONTHS = 12

export interface LogRetentionAudit {
    id: number
    executed_at: string
    /** Table de logs concernée par cette purge (app_logs, logs_crm, …). */
    table_name: string
    cutoff_at: string
    deleted_count: number
    oldest_deleted_at: string | null
    newest_deleted_at: string | null
    /** 'automatic' (job planifié) | 'manual' (déclenché depuis la console). */
    mode: string
    triggered_by: string | null
}

/**
 * Lecture du journal des suppressions automatiques (RGPD) des app_logs de plus
 * de 12 mois, et déclenchement manuel de la purge (filet de sécurité).
 *
 * La purge automatique est garantie côté base par un job pg_cron quotidien
 * (migration 20260610120000_app_logs_retention.sql). Ce hook ne fait
 * qu'afficher l'historique et permettre une exécution manuelle ponctuelle.
 */
export function useLogRetention() {
    const [entries, setEntries] = useState<LogRetentionAudit[]>([])
    const [loading, setLoading] = useState(true)
    const [purging, setPurging] = useState(false)

    const fetchAudit = useCallback(async () => {
        setLoading(true)
        // Lecture via RPC SECURITY DEFINER (voir logRetentionService) :
        // contourne la RLS (fragile sur le mapping id/user_id) tout en
        // gardant le contrôle d'admin côté base.
        const { data, error } = await fetchRetentionAudit(200)

        setLoading(false)
        if (error) {
            toast.error("Erreur lors du chargement du journal de rétention")
            return
        }
        setEntries((data ?? []) as LogRetentionAudit[])
    }, [])

    useEffect(() => {
        fetchAudit()
    }, [fetchAudit])

    // Pas de Realtime : l'audit de rétention est purement consultatif et la
    // purge automatique est un job pg_cron quotidien. Inscrire cette table dans
    // la publication ne se justifie pas (le journal se recharge au montage et
    // après une purge manuelle via `fetchAudit`).

    // months : ancienneté minimale (en mois) des logs à supprimer.
    // tables : sous-ensemble de tables ciblées ; vide/undefined = toutes.
    const purgeNow = useCallback(
        async (months: number = LOG_RETENTION_MONTHS, tables?: string[]) => {
            setPurging(true)
            const { data, error } = await purgeOldAppLogs(months, tables)

            setPurging(false)
            if (error) {
                toast.error("Échec de la purge des anciens logs")
                return
            }

            // La fonction renvoie une ligne par table purgée → on cumule.
            const rows = (data ?? []) as Pick<
                LogRetentionAudit,
                "deleted_count"
            >[]
            const deleted = rows.reduce(
                (sum, r) => sum + (r.deleted_count ?? 0),
                0
            )
            if (deleted > 0) {
                toast.success(
                    `${deleted} log(s) de plus de ${months} mois supprimé(s).`
                )
                // Recharge le journal d'audit pour afficher la ligne de purge.
                fetchAudit()
            } else {
                toast.info(`Aucun log de plus de ${months} mois à supprimer.`)
            }
        },
        [fetchAudit]
    )

    return { entries, loading, purging, purgeNow, refresh: fetchAudit }
}
