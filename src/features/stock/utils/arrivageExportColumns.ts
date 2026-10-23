import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { ARRIVAGE_STATUS_CONFIG } from "@/features/stock/constants"
import { fmtDate, fmtDatetime } from "@/features/stock/utils/arrivageGrouping"

/**
 * Définition des colonnes partagées entre l'export Excel et l'impression.
 * L'ordre et les clés doivent rester alignés sur `MasterColumns` du service
 * newsletter (newsletter-console/internal/excel/columns.go) : les deux sorties
 * sont censées être indiscernables.
 */

export type ColEmphasis = "normal" | "important" | "alert"

export interface ColDef {
    header:   string
    permKey:  string
    width:    number
    type:     "text" | "number" | "date"
    emphasis: ColEmphasis
    get:      (r: ArrivageManuelRow) => string | number
}

export const COLUMN_DEFS: ColDef[] = [
    {
        header: "Statut",       permKey: "status",               width: 13, type: "text",   emphasis: "normal",
        get: r => ARRIVAGE_STATUS_CONFIG[r.status]?.label ?? r.status,
    },
    {
        header: "Fournisseur",  permKey: "fournisseur_name",     width: 22, type: "text",   emphasis: "normal",
        get: r => r.fournisseur?.name ?? "",
    },
    {
        header: "Date facture", permKey: "invoice_date",         width: 13, type: "date",   emphasis: "alert",
        get: r => fmtDate(r.invoice_date),
    },
    {
        header: "Départ",       permKey: "departure_date",       width: 12, type: "date",   emphasis: "normal",
        get: r => fmtDate(r.departure_date),
    },
    {
        header: "Le Havre",     permKey: "port_arrival_date",    width: 12, type: "date",   emphasis: "normal",
        get: r => fmtDate(r.port_arrival_date),
    },
    {
        header: "Mode",         permKey: "transport_mode",       width: 10, type: "text",   emphasis: "normal",
        get: r => r.transport_mode ?? "",
    },
    {
        header: "N° Conteneur", permKey: "container_no",         width: 17, type: "text",   emphasis: "normal",
        get: r => r.container_no ?? "",
    },
    {
        header: "Déchargement", permKey: "prev_dechargement_at", width: 26, type: "text",   emphasis: "important",
        get: r => fmtDatetime(r.prev_dechargement_at),
    },
    {
        header: "Poids (kg)",   permKey: "total_weight_kg",      width: 11, type: "number", emphasis: "normal",
        get: r => r.total_weight_kg ?? "",
    },
    {
        header: "Quantité",     permKey: "total_qty",            width: 10, type: "number", emphasis: "normal",
        get: r => r.total_qty ?? "",
    },
    {
        header: "N° Interne",   permKey: "internal_ref",         width: 14, type: "text",   emphasis: "normal",
        get: r => r.conteneur_no_raw ?? "",
    },
    {
        header: "Lieu",         permKey: "fournisseur_lieu",     width: 18, type: "text",   emphasis: "normal",
        get: r => r.fournisseur?.siege_localisation ?? "",
    },
    {
        header: "Notes",        permKey: "notes",                width: 36, type: "text",   emphasis: "normal",
        get: r => r.notes ?? "",
    },
]

// ─── Palette partagée Excel / impression ──────────────────────────────────────

export const HEADER_FILLS: Record<ColEmphasis, string> = {
    normal:    "111827",
    important: "1E40AF",
    alert:     "991B1B",
}

/**
 * Le zébrage une-ligne-sur-deux aide l'œil à suivre une ligne de treize
 * colonnes : c'est du confort de lecture, et il donne sa respiration au tableau.
 * Il est donc conservé partout — sauf sur le jaune.
 *
 * Le jaune est la seule teinte dont la signification est vraiment lue : « cet
 * arrivage arrive ». Deux nuances de jaune font chercher au lecteur une
 * différence entre deux arrivages en route, différence qui n'existe pas. Un
 * aplat unique lève l'ambiguïté et fait lire un bloc d'arrivages en route d'un
 * seul tenant. Les autres teintes n'ont pas ce poids : leur alternance se lit
 * comme une rayure, pas comme un écart de sens.
 */
export const CELL_FILLS: Record<ColEmphasis, [string, string]> = {
    normal:    ["FFFFFF", "F3F4F6"],
    important: ["EFF6FF", "DBEAFE"], // bleu-50 / bleu-100
    alert:     ["FFF1F2", "FFE4E6"], // rosé-50 / rosé-100
}

/** Arrivage passé — grisé, italique, date de déchargement barrée. */
export const PAST_CELL_FILLS: [string, string] = ["F9FAFB", "F3F4F6"]

/**
 * Arrivage en route (déchargement fixé et pas encore passé) : la ligne entière
 * vire au jaune poussin, d'un seul ton. Signal le plus fort du tableau —
 * l'information qu'on vient chercher en l'ouvrant : ce qui arrive. Le texte
 * reste le quasi-noir habituel (111827), à un contraste de 13,5.
 */
export const SCHEDULED_CELL_FILL = "FDE047" // jaune poussin (jaune-300)

/**
 * Texte de la date de déchargement sur une ligne en route : rouge, pour que la
 * date à retenir se détache du quasi-noir du reste de la ligne. Rouge-700 plutôt
 * qu'un rouge plus sombre : 4,9 de contraste sur le jaune (seuil AA 4,5) tout en
 * restant nettement séparé du 111827 voisin (2,7) — un rouge plus foncé serait
 * plus lisible mais se lirait comme du texte noir, donc ne signalerait plus rien.
 */
export const SCHEDULED_DATE_FONT_COLOR = "B91C1C"

/**
 * Texte des lignes passées : éteint, mais lisible. L'ancien gris-400 (9CA3AF)
 * tombait à un contraste de 2,4 sur son fond — très en dessous du seuil WCAG AA
 * (4,5) : les lignes passées étaient décoratives plutôt que consultables.
 * 5B6270 donne 5,9, contre 17,7 pour le texte normal sur blanc.
 */
export const PAST_FONT_COLOR = "5B6270"

/**
 * Cellule modifiée depuis la dernière newsletter (newsletter uniquement — un
 * export manuel n'a pas d'état précédent auquel se comparer). Le jaune servant
 * aux arrivages en route, le changement se signale par un encadré épais et du
 * gras : le fond dit l'état de l'arrivage, l'encadré dit ce qui a bougé. Les
 * deux axes sont indépendants et lisibles en noir et blanc.
 */
export const CHANGED_BORDER_COLOR = "111827"

/**
 * Trois niveaux de gris volontairement distincts, lisibles même imprimés en
 * noir et blanc : en-tête de colonnes → bannière de mois → sous-total.
 */
export const MONTH_BANNER_FILL = "374151"
export const MONTH_TOTAL_FILL  = "D1D5DB"

// ─── Résolution du fond d'une cellule ─────────────────────────────────────────

/**
 * État d'une ligne, dans l'ordre de priorité. Une ligne ne peut pas être à la
 * fois `past` et `scheduled` (un déchargement futur rend la ligne à venir), mais
 * elle peut être `scheduled` ET `alert` — l'incident prime alors.
 */
export type RowState = "alert" | "past" | "scheduled" | "normal"

/**
 * Fond d'une cellule : l'état de la ligne l'emporte sur l'emphase de colonne.
 * Une seule définition, partagée par le classeur Excel et l'impression, pour que
 * les trois sorties (export manuel, newsletter, papier) restent superposables.
 */
export function resolveCellFill(state: RowState, emphasis: ColEmphasis, alt: boolean): string {
    const i = alt ? 1 : 0
    switch (state) {
        // Facture manquante à moins de 7 jours : toute la ligne vire au rosé.
        case "alert":
            return CELL_FILLS.alert[i]
        // Déchargement derrière nous : la ligne s'éteint, l'emphase bleue tombe.
        case "past":
            return PAST_CELL_FILLS[i]
        // En route : la ligne entière s'allume, d'un seul ton — voir CELL_FILLS.
        case "scheduled":
            return SCHEDULED_CELL_FILL
        default:
            return CELL_FILLS[emphasis][i]
    }
}
