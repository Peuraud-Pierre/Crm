import { AlertTriangle, Container, PackageCheck } from "lucide-react"
import { format, isToday, isTomorrow } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import { cn } from "@/shared/lib/utils"
import type { WidgetProps } from "@/shared/types/widget.types"
import { Badge } from "@/shared/ui/atoms/badge"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import {
    WidgetList,
    WidgetRow,
    type WidgetRowEmphasis,
} from "@/shared/ui/molecules/widget-list"
import { ARRIVAGE_STATUS_CONFIG, STOCK_PERMISSIONS } from "../constants"
import { fetchOpenArrivages } from "../services/dashboardWidgetService"
import type { ArrivageManuelRow } from "../types/arrivage-manuel.types"
import { STOCK_ROUTE_BASE } from "@/features/stock/types/ui.types"

const ROWS_PER_UNIT = 1.2

/** Horizon par défaut, en jours, si le réglage n'a jamais été touché. */
const DEFAULT_HORIZON = 14

/**
 * Les prochains déchargements.
 *
 * Le module répond à « qu'est-ce qui arrive bientôt ? », pas à « quels
 * conteneurs sont ouverts ? » : il ne montre que ceux dont le
 * déchargement est prévu à partir de maintenant, du plus proche au plus
 * lointain. Le filtre et le tri vivent dans le service, alignés sur ceux
 * du tableau (`components/flow/ArrivageLimitedTable.tsx`).
 *
 * Chaque ligne renvoie vers le conteneur : le module sert à repérer ce
 * qui bouge, pas à le traiter sur place.
 *
 * `/stock/flux/{id}` ouvre la fiche de LECTURE de l'arrivage, que `FlowBoard`
 * garde sur `stock.arrivage.view`. Le lien suit donc le même droit. Il exigeait
 * auparavant `stock.arrivage.update`, du temps où cette adresse ouvrait le
 * formulaire d'édition : un lecteur se retrouvait renvoyé au tableau alors que
 * la fiche lui était ouverte.
 *
 * Deuxième garde, distincte : `/stock` est gouvernée par `stock.view`,
 * alors que ce module ne demande que `stock.arrivage.view`. Un compte qui
 * a l'un sans l'autre voit le module mais ne peut ouvrir aucune de ses
 * cibles — ses lignes cessent alors d'être cliquables plutôt que de
 * mener à un NotFound.
 */
export default function OpenArrivagesWidget({
    height,
    compact,
    settings,
}: WidgetProps) {
    const { hasPermission, allowedRoutes } = useAuth()
    const canView = hasPermission(STOCK_PERMISSIONS.arrivageView)

    const limit = Math.max(3, Math.floor(height * ROWS_PER_UNIT))
    const horizon =
        typeof settings.horizon === "number"
            ? settings.horizon
            : DEFAULT_HORIZON

    const { data, loading, error } = useWidgetData(
        () => fetchOpenArrivages(limit, horizon),
        [limit, horizon],
        "OpenArrivagesWidget"
    )
    const rows: ArrivageManuelRow[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement des arrivages" />
            </div>
        )
    }

    if (error) {
        return (
            <EmptyState
                size="sm"
                variant="error"
                icon={AlertTriangle}
                title="Chargement impossible"
                description="Les arrivages n'ont pas pu être récupérés."
            />
        )
    }

    if (rows.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={PackageCheck}
                title="Aucun déchargement prévu"
                description={
                    horizon > 0
                        ? `Rien n'est attendu dans les ${horizon} prochains jours.`
                        : "Aucun conteneur en cours n'a de date de déchargement à venir."
                }
            />
        )
    }

    return (
        <WidgetList>
            {rows.map((row) => {
                const status = ARRIVAGE_STATUS_CONFIG[row.status]
                const target =
                    canView && row.id
                        ? `${STOCK_ROUTE_BASE}/flux/${row.id}`
                        : `${STOCK_ROUTE_BASE}/flux`

                return (
                    <WidgetRow
                        key={row.id}
                        to={
                            isRouteAllowed(target, allowedRoutes)
                                ? target
                                : undefined
                        }
                        icon={Container}
                        accent="chart-1"
                        compact={compact}
                        title={row.container_no}
                        meta={
                            row.fournisseur?.name ?? "Fournisseur non renseigné"
                        }
                        emphasis={dueEmphasis(row.prev_dechargement_at)}
                        trailing={
                            <span className="flex items-center gap-2">
                                <span>
                                    {formatDue(row.prev_dechargement_at)}
                                </span>
                                {status && !compact && (
                                    <Badge
                                        variant="outline"
                                        className={cn("shrink-0", status.className)}
                                    >
                                        {status.label}
                                    </Badge>
                                )}
                            </span>
                        }
                    />
                )
            })}
        </WidgetList>
    )
}

/**
 * Le déchargement du jour ou du lendemain est nommé plutôt que daté : à
 * cette échéance, « aujourd'hui » se lit plus vite qu'une date qu'il faut
 * comparer mentalement à celle du jour.
 */
function formatDue(value: string | null): string {
    if (!value) return "—"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"

    if (isToday(date)) return "aujourd'hui"
    if (isTomorrow(date)) return "demain"
    return format(date, "d MMM", { locale: fr })
}

/** Ce qui arrive aujourd'hui demande une attention que le reste n'a pas. */
function dueEmphasis(value: string | null): WidgetRowEmphasis {
    if (!value) return "default"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "default"

    return isToday(date) ? "warning" : "default"
}
