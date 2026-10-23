import {
    addDays,
    addMonths,
    addWeeks,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    startOfMonth,
    startOfWeek,
} from "date-fns"
import type {
    CommandeBoutique,
    LivraisonBoutique,
} from "@/features/commandes/types/commande.types"

/**
 * Planning de la salle de commande — fonctions pures.
 *
 * Une ligne par boutique, une colonne par jour. Une livraison se place sur sa
 * date d'expédition RÉELLE si elle est partie, sinon sur la date prévue :
 * le planning montre ce qui s'est passé et ce qui doit se passer, pas un
 * mélange des deux pour la même livraison.
 */

export type PlanningEchelle = "semaine" | "mois"

const DAY = "yyyy-MM-dd"
const WEEK_OPTS = { weekStartsOn: 1 } as const

export const toDay = (date: Date) => format(date, DAY)

/** Jours affichés autour de `anchor` ; la semaine commence le lundi. */
export function planningDays(anchor: Date, echelle: PlanningEchelle): string[] {
    const start = echelle === "semaine" ? startOfWeek(anchor, WEEK_OPTS) : startOfMonth(anchor)
    const end = echelle === "semaine" ? endOfWeek(anchor, WEEK_OPTS) : endOfMonth(anchor)
    return eachDayOfInterval({ start, end }).map(toDay)
}

/** Période suivante (+1) ou précédente (−1). */
export function shiftAnchor(anchor: Date, echelle: PlanningEchelle, step: 1 | -1): Date {
    return echelle === "semaine" ? addWeeks(anchor, step) : addMonths(anchor, step)
}

/** Jour où placer une livraison ; `null` si elle n'a aucune date. */
export function livraisonPlanningDay(l: Pick<LivraisonBoutique,
    "expediee_at" | "date_expedition_prevue" | "date_preparation_prevue">): string | null {
    if (l.expediee_at) return toDay(new Date(l.expediee_at))
    return l.date_expedition_prevue ?? l.date_preparation_prevue ?? null
}

/**
 * En retard : la date prévue de l'étape en cours est dépassée.
 *   pas encore partie  → date d'expédition prévue < aujourd'hui
 *   partie, pas reçue  → date de livraison prévue < aujourd'hui
 * Une livraison close (reçue, en litige, annulée) n'est plus en retard : le
 * litige a son propre signal.
 */
export function isEnRetard(l: Pick<LivraisonBoutique,
    "statut" | "date_expedition_prevue" | "date_livraison_prevue">, today: string): boolean {
    switch (l.statut) {
        case "planifiee":
        case "preparation":
            return !!l.date_expedition_prevue && l.date_expedition_prevue < today
        case "expediee":
        case "en_reception":
            return !!l.date_livraison_prevue && l.date_livraison_prevue < today
        default:
            return false
    }
}

export interface PlanningRow {
    boutiqueId: string
    boutiqueNom: string
    /** Livraisons par jour affiché. */
    livraisons: Map<string, LivraisonBoutique[]>
    /** Commandes dont la date souhaitée tombe ce jour-là. */
    echeances: Map<string, CommandeBoutique[]>
}

/**
 * Range livraisons et échéances de commande par boutique et par jour. Une
 * boutique sans rien sur la période garde sa ligne : le planning montre aussi
 * qui n'a rien reçu. Les commandes soldées ou annulées ne sont plus des
 * échéances.
 */
export function buildPlanningRows(
    boutiques: readonly { id: string; nom: string; actif: boolean }[],
    livraisons: readonly LivraisonBoutique[],
    commandes: readonly CommandeBoutique[],
    days: readonly string[],
): PlanningRow[] {
    const visible = new Set(days)
    const rows = new Map<string, PlanningRow>()
    const rowFor = (id: string, nom: string) => {
        let row = rows.get(id)
        if (!row) {
            row = { boutiqueId: id, boutiqueNom: nom, livraisons: new Map(), echeances: new Map() }
            rows.set(id, row)
        }
        return row
    }
    for (const b of boutiques) if (b.actif) rowFor(b.id, b.nom)

    for (const l of livraisons) {
        if (l.statut === "annulee") continue
        const day = livraisonPlanningDay(l)
        if (!day || !visible.has(day)) continue
        const row = rowFor(l.boutique_id, l.boutique_nom)
        row.livraisons.set(day, [...(row.livraisons.get(day) ?? []), l])
    }
    for (const c of commandes) {
        if (!c.date_souhaitee || !visible.has(c.date_souhaitee)) continue
        if (c.statut === "soldee" || c.statut === "annulee") continue
        const row = rowFor(c.boutique_id, c.boutique_nom)
        row.echeances.set(c.date_souhaitee, [...(row.echeances.get(c.date_souhaitee) ?? []), c])
    }
    return [...rows.values()].sort((a, b) => a.boutiqueNom.localeCompare(b.boutiqueNom, "fr"))
}

export interface PlanningKpis {
    commandesOuvertes: number
    livraisonsSemaine: number
    enRetard: number
    enLitige: number
    kgEcart: number
}

/** Bandeau de supervision. `today` en `yyyy-MM-dd`. */
export function planningKpis(
    livraisons: readonly LivraisonBoutique[],
    commandes: readonly CommandeBoutique[],
    today: string,
): PlanningKpis {
    const week = new Set(planningDays(new Date(`${today}T12:00:00`), "semaine"))
    return {
        commandesOuvertes: commandes.filter((c) => c.statut === "ouverte" || c.statut === "en_cours").length,
        livraisonsSemaine: livraisons.filter((l) => {
            if (l.statut === "annulee") return false
            const day = livraisonPlanningDay(l)
            return !!day && week.has(day)
        }).length,
        enRetard: livraisons.filter((l) => isEnRetard(l, today)).length,
        enLitige: livraisons.filter((l) => l.statut === "litige").length,
        kgEcart: livraisons.reduce((s, l) => s + (l.statut === "litige" ? l.kg_ecart : 0), 0),
    }
}

/** Lundi de la semaine qui suit `day` : date d'expédition proposée par défaut. */
export function prochainLundi(day: Date): string {
    return toDay(startOfWeek(addDays(day, 7), WEEK_OPTS))
}
