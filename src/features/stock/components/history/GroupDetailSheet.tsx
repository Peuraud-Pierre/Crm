import { useMemo } from "react"
import {
    ActivityDetailSheet,
    type ActivityDetailEntry,
} from "@/shared/ui/organisms/activity-detail-sheet"
import { GESTION_THEME } from "@/features/stock/theme"
import type { LogGroup } from "@/features/stock/types/history.types"
import {
    ACTION_ICON,
    ACTION_LABEL,
    ENTITY_ICON,
    ENTITY_LABEL,
    timeAgo,
    formatExact,
} from "../../utils/activityHelpers"

/**
 * Noms lisibles des colonnes du schéma `*_gestion`. Reste dans la feature : la
 * sheet partagée ne connaît aucun schéma, elle reçoit ce dictionnaire.
 */
const FIELD_LABELS: Record<string, string> = {
    bin:                  "BIN",
    din:                  "DIN",
    container_no:         "Conteneur",
    status:               "Statut",
    location:             "Emplacement",
    packing:              "Conditionnement",
    unit_price:           "Prix unitaire",
    name:                 "Nom",
    transport_mode:       "Mode transport",
    departure_date:       "Départ",
    port_arrival_date:    "Arrivée Le Havre",
    prev_dechargement_at: "Prév. déchargement",
    docked_at:            "Date quai",
    received_date:        "Réception",
    total_weight_kg:      "Poids (kg)",
    total_qty:            "Quantité",
    fournisseur_id:       "Fournisseur (id)",
    invoice_no:           "N° facture",
    invoice_date:         "Date facture",
    notes:                "Notes",
    // Salle de tri
    date_tri:               "Date du tri",
    heure_debut:            "Début",
    heure_fin:              "Fin",
    trieur_id:              "Trieur (id)",
    poids_initial_kg:       "Poids trié (kg)",
    poids_reparti_kg:       "Poids réparti (kg)",
    balles:                 "Balles",
    note:                   "Note",
    nom:                    "Nom",
    actif:                  "Actif",
    // Salle de commande
    statut:                 "Statut",
    date_souhaitee:         "Date souhaitée",
    motif_cloture:          "Motif de clôture",
    date_preparation_prevue: "Préparation prévue",
    date_expedition_prevue: "Expédition prévue",
    date_livraison_prevue:  "Livraison prévue",
    expediee_at:            "Expédiée le",
    receptionnee_at:        "Réceptionnée le",
    article:                "Article",
    article_id:             "Article (id)",
    palette_id:             "Palette (id)",
    lot_semaine:            "Lot",
    poids_kg_prevu:         "Poids prévu (kg)",
    poids_kg_recu:          "Poids reçu (kg)",
    etat:                   "État",
    ean_scanne:             "EAN lu",
    note_reception:         "Note de réception",
}

const VOCABULARY = {
    entityLabel: ENTITY_LABEL as Record<string, string>,
    entityIcon: ENTITY_ICON as Record<string, React.ReactNode>,
    actionLabel: ACTION_LABEL as Record<string, string>,
    actionIcon: ACTION_ICON as Record<string, React.ReactNode>,
}

/** Formatage des valeurs de ce module : les dates y sont rendues telles quelles. */
function fmtVal(v: unknown): string {
    if (v === null || v === undefined || v === "") return "—"
    if (typeof v === "boolean") return v ? "Oui" : "Non"
    return String(v)
}

interface GroupDetailSheetProps {
    group: LogGroup | null
    userMap: Map<string, string>
    open: boolean
    onClose: () => void
}

export function GroupDetailSheet({ group, userMap, open, onClose }: GroupDetailSheetProps) {
    const entries: ActivityDetailEntry[] = useMemo(
        () =>
            (group?.logs ?? []).map((log) => ({
                id: log.id,
                entityLabel: log.entity_label,
                description: log.description,
                createdAt: log.created_at,
                changes: log.changes,
            })),
        [group],
    )

    if (!group) return null

    return (
        <ActivityDetailSheet
            open={open}
            onClose={onClose}
            group={{ ...group, entityLabel: group.entity_label }}
            entries={entries}
            vocabulary={VOCABULARY}
            theme={GESTION_THEME}
            userName={group.user_id ? userMap.get(group.user_id) ?? null : null}
            fieldLabels={FIELD_LABELS}
            formatValue={fmtVal}
            formatTime={timeAgo}
            formatExactTime={formatExact}
        />
    )
}
