import { useMemo } from "react"
import {
    ActivityDetailSheet,
    type ActivityDetailEntry,
} from "@/shared/ui/organisms/activity-detail-sheet"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { entityDisplayLabel, formatDiffValue } from "@/features/stock_handpick/utils/historyHelpers"
import {
    ACTION_ICON,
    ENTITY_ICON,
    timeAgo,
    formatExact,
} from "@/features/stock_handpick/utils/activityHelpers"
import {
    HANDPICK_ACTION_LABEL,
    HANDPICK_ENTITY_LABEL,
    type HandpickLogGroup,
} from "@/features/stock_handpick/types/history.types"

/**
 * Noms lisibles des colonnes du schéma `*_handpick`.
 *
 * Le module affichait jusqu'ici le nom brut de la colonne (`raw_name`,
 * `emplacement_id`…) là où le stock principal traduisait : c'était l'un des
 * écarts les plus visibles entre les deux journaux. Les colonnes absentes de ce
 * dictionnaire retombent sur leur nom brut, comme dans le stock principal.
 */
const FIELD_LABELS: Record<string, string> = {
    raw_name: "Libellé",
    status: "Statut",
    packing: "Conditionnement",
    packing_mode: "Mode de conditionnement",
    unit_price: "Prix unitaire",
    name: "Nom",
    import_date: "Date d'entrée",
    fournisseur_id: "Usine (id)",
    category_id: "Catégorie (id)",
    emplacement_id: "Emplacement (id)",
    direction: "Sens",
    motif: "Motif",
    quantity: "Quantité",
    quantity_unit: "Unité",
    occurred_at: "Date du mouvement",
    reference_externe: "Référence",
    balle_label: "Balle",
    notes: "Notes",
    kind: "Type",
    code: "Code",
    parent_id: "Parent (id)",
    is_active: "Actif",
    tag: "Étiquette",
    // Expéditions : le trigger journalise désormais toutes les colonnes
    // descriptives d'un en-tête, pas seulement celles qui changent.
    flux_id: "Expédition (id)",
    container_no: "N° conteneur",
    conteneur_no_raw: "N° interne",
    transport_mode: "Mode de transport",
    departure_date: "Date de départ",
    port_arrival_date: "Arrivée au port",
    prev_dechargement_at: "Déchargement prévu",
    invoice_no: "N° de facture",
    invoice_date: "Date de facture",
    status_auto: "Statut automatique",
    total_value: "Valeur totale",
    emplacement_from_id: "Emplacement d'origine (id)",
    emplacement_to_id: "Emplacement de destination (id)",
    purchase_price: "Prix d'achat",
    treatment_cost: "Coût de traitement",
    placed_at: "Date de placement",
    borrowed_by: "Emprunteur (id)",
    borrowed_at: "Date d'emprunt",
    siege_localisation: "Siège",
}

const VOCABULARY = {
    entityLabel: HANDPICK_ENTITY_LABEL as Record<string, string>,
    entityIcon: ENTITY_ICON as Record<string, React.ReactNode>,
    actionLabel: HANDPICK_ACTION_LABEL as Record<string, string>,
    actionIcon: ACTION_ICON as Record<string, React.ReactNode>,
}

interface LogGroupSheetProps {
    group: HandpickLogGroup | null
    onClose: () => void
}

/** Détail d'un groupe : chaque entrée avec son diff colonne par colonne. */
export function LogGroupSheet({ group, onClose }: LogGroupSheetProps) {
    const entries: ActivityDetailEntry[] = useMemo(
        () =>
            (group?.entries ?? []).map((entry) => ({
                id: entry.id,
                entityId: entry.entity_id,
                entityLabel: entityDisplayLabel(entry),
                description: entry.description,
                createdAt: entry.created_at,
                changes: entry.changes,
            })),
        [group],
    )

    if (!group) return null

    return (
        <ActivityDetailSheet
            open
            onClose={onClose}
            group={{
                key: group.id,
                action: group.action,
                entity_type: group.entity_type,
                user_id: group.user_id,
                created_at: group.created_at,
                count: group.entries.length,
            }}
            entries={entries}
            vocabulary={VOCABULARY}
            theme={HANDPICK_THEME}
            userName={group.user_name}
            fieldLabels={FIELD_LABELS}
            // Ce module localise les nombres et met les horodatages en forme :
            // ses colonnes en portent, contrairement au stock principal.
            formatValue={formatDiffValue}
            formatTime={timeAgo}
            formatExactTime={formatExact}
            // Une balle handpick n'a pas de code lisible : son identifiant
            // technique est le seul moyen de la retrouver.
            entryFooter={(entry) =>
                entry.entityId ? (
                    <span className={cn(HANDPICK_THEME.card.identity, "mt-1 block truncate")}>
                        {entry.entityId}
                    </span>
                ) : null
            }
        />
    )
}
