/**
 * eventTypes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SOURCE DE VÉRITÉ UNIQUE des types d'événements / RDV du CRM.
 *
 * Avant ce fichier, la config était dispersée sur 3 listes concurrentes
 * (EVENT_TYPES du calendrier, KNOWN_EVENT_TYPES/EVENT_TYPE_LABELS de l'analytics,
 * INTERACTION_TYPES de la fiche client) + 3 implémentations divergentes de
 * `getEventTheme`. Ajouter ou modifier un type (ex. "rdv visio achat") imposait
 * d'éditer une dizaine d'endroits.
 *
 * Désormais : on décrit chaque type UNE fois dans `EVENT_TYPE_DEFS`, et tout le
 * reste (libellés, couleurs de formulaire, thèmes calendrier, listes analytics,
 * sets Amelia) en est dérivé.
 *
 * Pour ajouter/modifier un type : éditer UNIQUEMENT `EVENT_TYPE_DEFS`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Thèmes visuels (palette définie une seule fois par couleur)
// ─────────────────────────────────────────────────────────────────────────────

import { CHART_PALETTE } from "@/shared/lib/chartPalette"

export interface EventTheme {
    /** Fond carte calendrier (mois/semaine/sidebar). */
    bg: string
    /** Couleur de texte. */
    text: string
    /** Pastille ronde. */
    dot: string
    /** Bordure complète. */
    borderAll: string
    /** Bordure gauche (vue jour). */
    borderLeft: string
    /** Badge compact (modale détails). */
    badge: string
}

type ThemeColor =
    | "green"
    | "purple"
    | "indigo"
    | "blue"
    | "orange"
    | "red"
    | "gray"

const THEMES: Record<ThemeColor, EventTheme> = {
    // vert — --chart-1 (131°), correspondance exacte
    green: {
        bg: "bg-chart-1/15",
        text: "text-chart-1",
        dot: "bg-chart-1",
        borderAll: "border-chart-1/30",
        borderLeft: "border-l-chart-1",
        badge: "bg-chart-1/15 text-chart-1",
    },
    // violet — --chart-4 (270°), correspondance exacte
    purple: {
        bg: "bg-chart-4/15",
        text: "text-chart-4",
        dot: "bg-chart-4",
        borderAll: "border-chart-4/30",
        borderLeft: "border-l-chart-4",
        badge: "bg-chart-4/15 text-chart-4",
    },
    // indigo — --chart-7 (190°), teinte distincte du bleu
    indigo: {
        bg: "bg-chart-7/15",
        text: "text-chart-7",
        dot: "bg-chart-7",
        borderAll: "border-chart-7/30",
        borderLeft: "border-l-chart-7",
        badge: "bg-chart-7/15 text-chart-7",
    },
    // bleu — --chart-2 (210°), correspondance exacte
    blue: {
        bg: "bg-chart-2/15",
        text: "text-chart-2",
        dot: "bg-chart-2",
        borderAll: "border-chart-2/30",
        borderLeft: "border-l-chart-2",
        badge: "bg-chart-2/15 text-chart-2",
    },
    // orange — --chart-3 (15°)
    orange: {
        bg: "bg-chart-3/15",
        text: "text-chart-3",
        dot: "bg-chart-3",
        borderAll: "border-chart-3/30",
        borderLeft: "border-l-chart-3",
        badge: "bg-chart-3/15 text-chart-3",
    },
    // SÉMANTIQUE : « Non Disponible »
    red: {
        bg: "bg-destructive/15",
        text: "text-destructive",
        dot: "bg-destructive",
        borderAll: "border-destructive/30",
        borderLeft: "border-l-destructive",
        badge: "bg-destructive/15 text-destructive",
    },
    // SÉMANTIQUE : « Autre », neutre
    gray: {
        bg: "bg-muted-foreground/15",
        text: "text-muted-foreground",
        dot: "bg-muted-foreground",
        borderAll: "border-muted-foreground/30",
        borderLeft: "border-l-muted-foreground",
        badge: "bg-muted-foreground/15 text-muted-foreground",
    },
}

// ─────────────────────────────────────────────────────────────────────────────
// Définition d'un type d'événement
// ─────────────────────────────────────────────────────────────────────────────

export interface EventTypeDefFull {
    /** Valeur stockée en base (`event.nom`). Casse exacte conservée. */
    value: string
    /** Libellé d'affichage canonique (accentué). */
    label: string
    /** Couleur de la pastille dans les formulaires (classe Tailwind). */
    color: string
    /** Couleur du bouton dans les formulaires (classes Tailwind). */
    btnColor: string
    /** Thème calendrier complet. */
    color_theme: ThemeColor
    /** Proposé dans les formulaires de création. */
    showInForm: boolean
    /** Reconnu comme type "officiel" en analytics (sinon replié sur "divers"). */
    knownInAnalytics: boolean
    /** Crée un créneau Amelia (RDV propagé au bridge Go). */
    createsSlot: boolean
    /** Indisponibilité : propagé à Amelia comme simple "block". */
    isBlock: boolean
}

/**
 * ⚠️ SEULE liste à éditer pour ajouter/modifier un type d'événement.
 * `createsSlot` doit rester aligné avec ameliaServiceMapping (bridge Go).
 */
export const EVENT_TYPE_DEFS: EventTypeDefFull[] = [
    {
        value: "rdv physique achat",
        label: "RDV physique achat",
        color: "bg-chart-1",
        btnColor: "bg-chart-1 hover:bg-chart-1/90 shadow-chart-1/20",
        color_theme: "green",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: true,
        isBlock: false,
    },
    {
        value: "rdv physique decouverte",
        label: "RDV physique découverte",
        color: "bg-chart-4",
        btnColor: "bg-chart-4 hover:bg-chart-4/90 shadow-chart-4/20",
        color_theme: "purple",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: true,
        isBlock: false,
    },
    {
        value: "rdv Visio reassort",
        label: "RDV visio reassort",
        color: "bg-chart-7",
        btnColor: "bg-chart-7 hover:bg-chart-7/90 shadow-chart-7/20",
        color_theme: "indigo",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: false,
        isBlock: false,
    },
    {
        value: "rdv decouverte visio",
        label: "RDV visio découverte",
        color: "bg-chart-2",
        btnColor: "bg-chart-2 hover:bg-chart-2/90 shadow-chart-2/20",
        color_theme: "blue",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: true,
        isBlock: false,
    },
    {
        // Type historique : retiré du formulaire de création (remplacé par les
        // types physique/visio découverte), mais toujours présent en base →
        // doit rester reconnu par l'analytics (classifyRdvType : visio) et
        // propagé à Amelia lors des updates d'anciens événements.
        value: "rdv visio achat",
        label: "RDV visio achat",
        color: "bg-chart-7",
        btnColor: "bg-chart-7 hover:bg-chart-7/90 shadow-chart-7/20",
        color_theme: "indigo",
        showInForm: false,
        knownInAnalytics: true,
        createsSlot: true,
        isBlock: false,
    },
    {
        value: "appel",
        label: "Appel",
        color: "bg-chart-3",
        btnColor: "bg-chart-3 hover:bg-chart-3/90 shadow-chart-3/20",
        color_theme: "orange",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: false,
        isBlock: false,
    },
    {
        value: "Non Disponible",
        label: "Non Disponible",
        color: "bg-destructive",
        btnColor:
            "bg-destructive hover:bg-destructive/90 shadow-destructive/20",
        color_theme: "red",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: false,
        isBlock: true,
    },
    {
        value: "other",
        label: "Autre",
        color: "bg-muted-foreground",
        btnColor:
            "bg-muted-foreground hover:bg-muted-foreground/90 shadow-muted-foreground/20",
        color_theme: "gray",
        showInForm: true,
        knownInAnalytics: true,
        createsSlot: false,
        isBlock: false,
    },
    {
        value: "divers",
        label: "Autre",
        color: "bg-muted-foreground",
        btnColor:
            "bg-muted-foreground hover:bg-muted-foreground/90 shadow-muted-foreground/20",
        color_theme: "gray",
        showInForm: false,
        knownInAnalytics: true,
        createsSlot: false,
        isBlock: false,
    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Dérivés — ne jamais éditer à la main, tout vient de EVENT_TYPE_DEFS
// ─────────────────────────────────────────────────────────────────────────────

/** Type minimal consommé par les formulaires (Select de création). */
export type EventTypeDef = {
    value: string
    label: string
    color: string
    btnColor: string
}

/** Liste pour les formulaires de création (calendrier + fiche client). */
export const EVENT_TYPES: EventTypeDef[] = EVENT_TYPE_DEFS.filter(
    (d) => d.showInForm
).map(({ value, label, color, btnColor }) => ({
    value,
    label,
    color,
    btnColor,
}))

/** Types "officiels" pour l'analytics (en minuscules, comme `event.nom` normalisé). */
export const KNOWN_EVENT_TYPES: string[] = EVENT_TYPE_DEFS.filter(
    (d) => d.knownInAnalytics
).map((d) => d.value.toLowerCase())

/** Map type normalisé → libellé d'affichage. */
export const EVENT_TYPE_LABELS: Record<string, string> = {
    ...Object.fromEntries(
        EVENT_TYPE_DEFS.map((d) => [d.value.toLowerCase(), d.label])
    ),
    // Clés de la répartition mutuellement exclusive achat/decouverte/visio
    // (cf. classifyRdvType), utilisées par le widget RDV par commercial.
    achat: "Achat",
    decouverte: "Découverte",
    visio: "Visio",
}

/** Couleurs génériques pour les séries de graphiques (palette partagée du design system). */
export const CHART_COLORS = CHART_PALETTE

/** Natures de RDV propagées à Amelia comme créneau (service IDs 1/2/3 du bridge Go). */
export const AMELIA_RDV_TYPES = new Set(
    EVENT_TYPE_DEFS.filter((d) => d.createsSlot).map((d) => d.value)
)

/** Natures propagées à Amelia comme simple "block" (indisponibilités). */
export const AMELIA_BLOCK_TYPES = new Set(
    EVENT_TYPE_DEFS.filter((d) => d.isBlock).map((d) => d.value)
)

/**
 * Natures qui rendent le commercial INDISPONIBLE sur le créneau : vrais RDV
 * (`createsSlot`) + indisponibilités (`isBlock`). Base de la détection de
 * conflit (`fetchBusySlots` / `isSlotBusy`).
 *
 * Un RDV pris par un prospect via Amelia arrive dans `Event_calendar` avec la
 * nature du service (`rdv physique achat`…), jamais "Non Disponible" : filtrer
 * sur cette seule valeur rendait ces RDV — et ceux des autres commerciaux —
 * invisibles au check de conflit.
 *
 * Exclus volontairement : `appel`, , `other`, `divers`, qui
 * sont des traces d'activité et ne doivent pas bloquer la prise de RDV.
 */
export const SLOT_BLOCKING_TYPES = new Set(
    EVENT_TYPE_DEFS.filter((d) => d.createsSlot || d.isBlock).map(
        (d) => d.value
    )
)

// ─────────────────────────────────────────────────────────────────────────────
// Résolution & helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout le thème visuel d'un événement à partir de son `nom`.
 * 1) correspondance exacte avec une entrée du registre (utilise son `color_theme`) ;
 * 2) repli sur un matching par mots-clés, pour rester robuste face aux valeurs
 *    historiques non normalisées en base (ex. anciens "rdv visio achat").
 */
export const getEventTheme = (nom: string | null | undefined): EventTheme => {
    const type = (nom || "other").toLowerCase()

    const def = EVENT_TYPE_DEFS.find((d) => d.value.toLowerCase() === type)
    if (def) return THEMES[def.color_theme]

    if (type.includes("non disponible") || type.includes("indisponible"))
        return THEMES.red
    if (type.includes("achat") && type.includes("physique")) return THEMES.green
    if (type.includes("decouverte") && type.includes("physique"))
        return THEMES.purple
    if (type.includes("visio") && type.includes("achat")) return THEMES.indigo
    if (type.includes("decouverte") && type.includes("visio"))
        return THEMES.blue
    if (type === "appel") return THEMES.orange

    return THEMES.gray
}

/** Normalise un `event.nom` vers un type analytics connu, sinon "divers". */
export const normalizeEventType = (nom: string | undefined | null): string => {
    if (!nom) return "divers"
    const lower = nom.trim().toLowerCase()
    return KNOWN_EVENT_TYPES.includes(lower) ? lower : "divers"
}
