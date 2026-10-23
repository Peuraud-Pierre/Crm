import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import {
    BASE_PATH,
    RUNS_FETCH_LIMIT,
} from "@/features/arrivage-admin/constants"
import { ApiLogsPanel } from "@/features/arrivage-admin/components/logs/ApiLogsPanel"
import { RunDetailSheet } from "@/features/arrivage-admin/components/logs/RunDetailSheet"
import { RunHistoryPanel } from "@/features/arrivage-admin/components/logs/RunHistoryPanel"
import { useNewsletterRuns } from "@/features/arrivage-admin/hooks/data/useNewsletterRuns"
import type { RunStatus } from "@/features/arrivage-admin/types"

const LOGS_PATH = `${BASE_PATH}/logs`

interface LogsTabProps {
    /** Segment `detail` de l'URL : id de l'envoi dont la sheet est ouverte. */
    detail?: string
}

/**
 * Onglet « Logs » : l'historique métier des envois d'abord, le journal
 * technique de l'API ensuite.
 *
 * La sheet de détail est **dérivée de l'URL** (docs/ROUTING.md) : `selectedRun`
 * est recalculé à chaque rendu, jamais stocké. Le seul `useEffect` est une
 * garde contre un id introuvable — pas une synchronisation bidirectionnelle.
 */
export function LogsTab({ detail }: LogsTabProps) {
    const navigate = useNavigate()
    const [status, setStatus] = useState<RunStatus | "">("")

    const { runs, loading, error, refetch } = useNewsletterRuns(
        RUNS_FETCH_LIMIT,
        status
    )

    const selectedRun = detail
        ? (runs.find(r => r.id === detail) ?? null)
        : null

    // Id présent dans l'URL mais introuvable une fois les runs chargés : on
    // revient à la liste sans empiler d'entrée d'historique. Le filtre de
    // statut peut légitimement masquer un run — d'où la garde sur `status`,
    // qui évite de fermer la sheet à cause d'un simple filtrage.
    useEffect(() => {
        if (detail && !loading && !selectedRun && status === "") {
            navigate(LOGS_PATH, { replace: true })
        }
    }, [detail, loading, selectedRun, status, navigate])

    return (
        <div className="space-y-6">
            <RunHistoryPanel
                runs={runs}
                loading={loading}
                error={error}
                status={status}
                onStatusChange={setStatus}
                onRefresh={refetch}
                // Push : le bouton retour du navigateur referme la sheet.
                onSelect={run => navigate(`${LOGS_PATH}/${run.id}`)}
            />

            <ApiLogsPanel />

            <RunDetailSheet
                run={selectedRun}
                onOpenChange={open => !open && navigate(LOGS_PATH)}
            />
        </div>
    )
}
