/**
 * analytics.ts — Types du module Analytics
 *
 * Regroupe les types propres au tableau de bord analytique :
 * périodes, identifiants de widgets.
 */

// `WidgetId` ci-dessous (ligne ~20) est un ancien doublon incomplet (8 clés)
// du vrai type déclaré dans types/stats.ts (11 clés, aligné sur
// DEFAULT_WIDGET_CONFIG et Widget/*.tsx) — non renommé ici pour ne pas
// élargir le correctif ; SectionKey ci-dessous importe la version réelle
// sous un autre nom pour ne pas hériter de cet oubli.
import type { WidgetId as ChartWidgetId } from "./stats"

// ─────────────────────────────────────────────────────────────────────────────
// Périodes
// ─────────────────────────────────────────────────────────────────────────────

/** Granularité temporelle sélectionnable dans le dashboard Analytics. */
export type PeriodType = "day" | "week" | "month" | "quarter" | "year"

// ─────────────────────────────────────────────────────────────────────────────
// Widgets
// ─────────────────────────────────────────────────────────────────────────────

/** Identifiant unique de chaque widget du dashboard Analytics. */
export type WidgetId =
    | "rdvPerformance"
    | "revenue"
    | "rdvByPerson"
    | "activitesByType"
    | "activitesByOwner"
    | "funnel"
    | "showNoShow"
    | "provenance"

// ─────────────────────────────────────────────────────────────────────────────
// Ordre des modules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifiant d'un module réordonnable de l'onglet Analytics : le widget
 * « paliers » (conditionnel, voir EventsPalier.TARGET_IDS) et chaque
 * graphique individuellement.
 *
 * Le Header (filtres) n'en fait jamais partie : sa racine est
 * `position: sticky`, et un `transform` CSS sur un ancêtre casse ce
 * positionnement — un premier essai de glisser-déposer couvrant aussi le
 * Header en avait fait les frais.
 *
 * Les KPIs (CA, devis, leads, RDV) non plus : les faire passer par la
 * grille de disposition partagée changeait leur taille par rapport à
 * l'origine (leur grille interne de tuiles perdait la largeur pleine page
 * qu'elle avait hors de tout wrapper) — ils restent donc un bloc autonome,
 * rendu tel quel juste sous le Header (AnalyticsTab.tsx), jamais réordonné.
 */
export type SectionKey = "eventsPalier" | ChartWidgetId

/** Ordre par défaut des modules, tant que l'utilisateur n'a rien réordonné —
 *  reprend l'ordre d'affichage historique (ex-Charts.tsx). */
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
    "eventsPalier",
    "rdvPerformance",
    "revenue",
    "showNoShow",
    "provenance",
    "produitsRecherches",
    "produitsRechercheEvolution",
    "rdvByType",
    "activitesByType",
    "activitesByOwner",
    "rdvByPerson",
    "funnel",
]

const SECTION_KEY_SET: ReadonlySet<string> = new Set(DEFAULT_SECTION_ORDER)

/** Garde-fou : une valeur lue en base est-elle bien une SectionKey connue ? */
export function isSectionKey(value: unknown): value is SectionKey {
    return typeof value === "string" && SECTION_KEY_SET.has(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Taille des modules
// ─────────────────────────────────────────────────────────────────────────────

/** Largeur d'un module dans la grille 2 colonnes : une cellule ("half") ou
 *  les deux ("full"). */
export type SectionSize = "half" | "full"

/** Garde-fou : une valeur lue en base est-elle bien une SectionSize connue ? */
export function isSectionSize(value: unknown): value is SectionSize {
    return value === "half" || value === "full"
}

/** Position + taille d'un module — unité persistée par useAnalyticsLayout. */
export interface SectionLayoutItem {
    id: SectionKey
    size: SectionSize
}

/** Tailles par défaut : eventsPalier (large barre de progression) en pleine
 *  largeur, tous les autres graphiques en demi-largeur. */
export const DEFAULT_SECTION_LAYOUT: SectionLayoutItem[] = DEFAULT_SECTION_ORDER.map(
    (id) => ({ id, size: id === "eventsPalier" ? "full" : "half" })
)
