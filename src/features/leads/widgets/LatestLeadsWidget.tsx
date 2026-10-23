import { AlertTriangle, Inbox, UserPlus } from "lucide-react"
import { formatDistanceToNow, subDays } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import {
    fetchLatestLeads,
    fetchLeadsSince,
    type LeadRow,
} from "../services/leadsService"

const ROWS_PER_UNIT = 1.2

/**
 * Page où l'on traite un lead : le CRM, et non les statistiques.
 *
 * Un lead est une personne à rappeler, pas un point sur une courbe — le
 * module renvoyait vers `/analytics/leads`, qui en donne le volume et la
 * répartition mais ne permet rien d'en faire.
 *
 * Cette cible est gouvernée par `crm.view`, alors que le module ne
 * demande que `leads_stats.view`. Les deux codes sont bien distincts et
 * un compte peut avoir le second sans le premier : le lien n'est donc
 * proposé que si la page s'ouvre vraiment. La permission du module reste
 * volontairement `leads_stats.view` — la durcir retirerait le module à
 * des profils qui ont légitimement le droit de voir les leads.
 */
const CRM_TARGET = "/crm/clients"

/** Fenêtres proposées au réglage `period`, en jours. `0` = tout. */
const PERIOD_DAYS: Record<string, number> = {
    all: 0,
    "7": 7,
    "30": 30,
    "90": 90,
}

/**
 * Les derniers leads arrivés.
 *
 * Ni téléphone ni courriel affichés : ce sont des coordonnées
 * personnelles, et elles n'ont pas à traîner sur une page d'accueil qui
 * reste ouverte toute la journée. Le module dit qu'il y a quelqu'un à
 * rappeler ; la fiche complète est à un clic.
 */
export default function LatestLeadsWidget({
    height,
    compact,
    settings,
}: WidgetProps) {
    const { allowedRoutes } = useAuth()

    const limit = Math.max(3, Math.floor(height * ROWS_PER_UNIT))
    const days =
        PERIOD_DAYS[
            typeof settings.period === "string" ? settings.period : "all"
        ] ?? 0

    const { data, loading, error } = useWidgetData(
        () => fetchLeads(limit, days),
        [limit, days],
        "LatestLeadsWidget"
    )
    const leads: LeadRow[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement des leads" />
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
                description="Les derniers leads n'ont pas pu être récupérés."
            />
        )
    }

    if (leads.length === 0) {
        return (
            <EmptyState
                size="sm"
                // Une fenêtre vide est le résultat d'un filtre, pas un
                // domaine vide : les deux n'appellent pas la même action
                // de sortie (DESIGN_SYSTEM.md §13.8).
                variant={days > 0 ? "search" : "default"}
                icon={Inbox}
                title="Aucun lead"
                description={
                    days > 0
                        ? `Aucune demande n'est arrivée depuis ${days} jours.`
                        : "Aucune demande n'est encore arrivée."
                }
            />
        )
    }

    const target = isRouteAllowed(CRM_TARGET, allowedRoutes)
        ? CRM_TARGET
        : undefined

    return (
        <WidgetList>
            {leads.map((lead) => (
                <WidgetRow
                    key={lead.id}
                    to={target}
                    icon={UserPlus}
                    accent="chart-5"
                    compact={compact}
                    title={lead.name}
                    meta={[lead.city_found, lead.activity, lead.urgency]
                        .filter(Boolean)
                        .join(" · ")}
                    trailing={formatDistanceToNow(new Date(lead.created_at), {
                        addSuffix: true,
                        locale: fr,
                    })}
                />
            ))}
        </WidgetList>
    )
}

/**
 * Sans fenêtre, `fetchLatestLeads` suffit — inutile de calculer une date
 * de début pour ne rien borner.
 */
async function fetchLeads(limit: number, days: number): Promise<LeadRow[]> {
    if (days <= 0) return fetchLatestLeads(limit)

    const { data, error } = await fetchLeadsSince(
        subDays(new Date(), days).toISOString()
    )
    if (error) throw error

    return (data ?? []).slice(0, limit)
}
