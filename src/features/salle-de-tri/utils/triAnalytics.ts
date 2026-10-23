import { differenceInCalendarDays, format, getISOWeek, getISOWeekYear, parseISO, subDays } from "date-fns"
import { TRI_ECART_SEUIL_KG } from "@/features/salle-de-tri/constants"
import type {
    FicheTriBalle,
    FicheTriComplete,
    TriFilters,
} from "@/features/salle-de-tri/types/tri.types"

/**
 * Filtres et statistiques de la salle de tri — fonctions pures.
 *
 * Deux grandeurs à ne pas confondre :
 *   * le POIDS INITIAL des balles = ce qui a été trié (kg triés, kg/h,
 *     qualité pondérée) ;
 *   * la RÉPARTITION = où ces kilos sont partis (MAG, KS…). Les vues par
 *     type de sortie la lisent, et seulement elle.
 *
 * Deux niveaux de filtre :
 *   * en-tête (trieur, période, recherche, écarts) : garde ou écarte la
 *     fiche entière ;
 *   * balle (fournisseur, catégorie, qualité minimale, type de sortie) : ne
 *     garde QUE les balles qui correspondent, et écarte une fiche dont il ne reste rien.
 *     Filtrer sur un type ne garde, dans chaque balle, que la part partie
 *     vers ce type : « combien de kg de jean en MAG » compte les kilos de
 *     jean en MAG, pas les balles entières.
 */

export const DEFAULT_TRI_FILTERS: TriFilters = {
    trieurId: "all",
    fournisseurId: "all",
    categoryId: "all",
    sortieId: "all",
    qualiteMin: 1,
    ecartsSeuls: false,
    dateFrom: "",
    dateTo: "",
    search: "",
}

/** Une balle est en écart quand son poids réparti s'éloigne de son poids initial. */
export const isBalleEcart = (b: Pick<FicheTriBalle, "ecart_kg">) => Math.abs(b.ecart_kg) >= TRI_ECART_SEUIL_KG

const hasBalleFilter = (f: TriFilters) =>
    f.fournisseurId !== "all" || f.categoryId !== "all" || f.sortieId !== "all" || f.qualiteMin > 1

function narrowBalle(balle: FicheTriBalle, f: TriFilters): FicheTriBalle | null {
    if (f.fournisseurId !== "all" && balle.fournisseur_id !== f.fournisseurId) return null
    if (f.categoryId !== "all" && balle.category_id !== f.categoryId) return null
    if (balle.qualite < f.qualiteMin) return null
    if (f.sortieId === "all") return balle
    const repartition = balle.repartition.filter((r) => r.sortie_id === f.sortieId)
    return repartition.length ? { ...balle, repartition } : null
}

/**
 * Applique les filtres. `categoryName` sert à la recherche libre, qui doit
 * trouver « jean » dans les catégories des balles.
 */
export function applyTriFilters(
    fiches: readonly FicheTriComplete[],
    f: TriFilters,
    categoryName: (id: string) => string = () => "",
): FicheTriComplete[] {
    const query = f.search.trim().toLowerCase()
    const balleFilter = hasBalleFilter(f)
    const out: FicheTriComplete[] = []
    for (const fiche of fiches) {
        if (f.trieurId !== "all" && fiche.trieur_id !== f.trieurId) continue
        if (f.dateFrom && fiche.date_tri < f.dateFrom) continue
        if (f.dateTo && fiche.date_tri > f.dateTo) continue
        if (f.ecartsSeuls && !fiche.balles.some(isBalleEcart)) continue
        if (query) {
            const haystack = [
                fiche.code,
                fiche.trieur_nom,
                ...fiche.balles.map((b) => `${b.fournisseur_nom ?? ""} ${categoryName(b.category_id)} ${b.note ?? ""}`),
            ].join(" ").toLowerCase()
            if (!haystack.includes(query)) continue
        }
        if (!balleFilter) {
            out.push(fiche)
            continue
        }
        const balles = fiche.balles.flatMap((b) => narrowBalle(b, f) ?? [])
        if (balles.length > 0) out.push({ ...fiche, balles })
    }
    return out
}

/** Nombre de filtres actifs, pour le badge de la barre de filtres. */
export function countTriFilters(f: TriFilters): number {
    let n = 0
    if (f.trieurId !== "all") n++
    if (f.fournisseurId !== "all") n++
    if (f.categoryId !== "all") n++
    if (f.sortieId !== "all") n++
    if (f.qualiteMin > 1) n++
    if (f.ecartsSeuls) n++
    if (f.dateFrom || f.dateTo) n++
    return n
}

// ── Sommes ───────────────────────────────────────────────────────────────────

/** Kilos triés : la somme des poids initiaux. */
export const poidsInitial = (balles: readonly FicheTriBalle[]) =>
    balles.reduce((s, b) => s + Number(b.poids_initial_kg), 0)

/** Kilos répartis (sur les parts présentes : un filtre de type les restreint). */
export const poidsReparti = (balles: readonly FicheTriBalle[]) =>
    balles.reduce((s, b) => s + b.repartition.reduce((t, r) => t + Number(r.poids_kg), 0), 0)

/**
 * Fournisseurs des balles d'une fiche, sans doublon, triés : « ABC, XYZ ».
 * Lu sur les balles (filtrées), pas sur l'agrégat de la vue — filtrer sur un
 * fournisseur ne doit plus montrer les autres.
 */
export function fournisseursDe(fiche: Pick<FicheTriComplete, "balles">): string {
    const noms = new Set(fiche.balles.map((b) => b.fournisseur_nom ?? "?"))
    return [...noms].sort((a, b) => a.localeCompare(b, "fr")).join(", ") || "—"
}

/** Kilos par type de sortie. */
export function kgParSortie(balles: readonly FicheTriBalle[]): Map<string, number> {
    const kg = new Map<string, number>()
    for (const b of balles) {
        for (const r of b.repartition) kg.set(r.sortie_id, (kg.get(r.sortie_id) ?? 0) + Number(r.poids_kg))
    }
    return kg
}

/** Qualité moyenne pondérée par le poids initial ; `null` sans kilo. */
export function qualitePonderee(balles: readonly FicheTriBalle[]): number | null {
    const kg = poidsInitial(balles)
    if (kg <= 0) return null
    return balles.reduce((s, b) => s + Number(b.poids_initial_kg) * b.qualite, 0) / kg
}

/** Balles en écart et somme de leurs écarts (négative quand il manque des kilos). */
export function ecarts(balles: readonly FicheTriBalle[]): { balles: number; kg: number } {
    const enEcart = balles.filter(isBalleEcart)
    return { balles: enEcart.length, kg: enEcart.reduce((s, b) => s + Number(b.ecart_kg), 0) }
}

/**
 * Kilos triés par heure. Seules les fiches qui portent des horaires comptent,
 * au numérateur COMME au dénominateur : une fiche sans durée ne doit pas
 * gonfler la productivité de ses kilos. `null` si aucune fiche n'a de durée.
 */
export function kgParHeure(fiches: readonly FicheTriComplete[]): number | null {
    let kg = 0
    let minutes = 0
    for (const fiche of fiches) {
        if (!fiche.duree_minutes || fiche.duree_minutes <= 0) continue
        kg += poidsInitial(fiche.balles)
        minutes += fiche.duree_minutes
    }
    return minutes > 0 ? kg / (minutes / 60) : null
}

/** Clé de semaine ISO : « 2026-W38 ». */
export function isoWeekKey(day: string): string {
    const date = parseISO(day)
    return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`
}

// ── Statistiques ─────────────────────────────────────────────────────────────

export interface TriGroupStat {
    id: string
    /** Kilos triés (poids initial). */
    kg: number
    fiches: number
    balles: number
    qualite: number | null
    /** `null` pour un fournisseur : le temps appartient à la fiche, pas à la balle. */
    kgParHeure: number | null
    /** Balles en écart. */
    ecarts: number
}

export interface TriCategorieRow {
    categoryId: string
    /** Kilos triés (poids initial). */
    kg: number
    balles: number
    /** Kilos répartis par type de sortie. */
    bySortie: Record<string, number>
    qualite: number | null
}

export interface TriAnalytics {
    totals: {
        kg: number
        reparti: number
        fiches: number
        balles: number
        minutes: number
        kgParHeure: number | null
        qualite: number | null
        ecarts: { balles: number; kg: number }
    }
    /** Kilos répartis par type de sortie, décroissants ; `pct` du total réparti. */
    parSortie: { sortieId: string; kg: number; pct: number }[]
    /** Une entrée par semaine ISO, croissante ; une clé par type de sortie. */
    parSemaine: ({ semaine: string } & Record<string, number | string>)[]
    parTrieur: TriGroupStat[]
    parFournisseur: TriGroupStat[]
    /** « Ce qui a été trié » : catégorie × type de sortie, décroissant. */
    parCategorie: TriCategorieRow[]
}

function groupStats(
    fiches: readonly FicheTriComplete[],
    key: (f: FicheTriComplete) => string,
): TriGroupStat[] {
    const groups = new Map<string, FicheTriComplete[]>()
    for (const fiche of fiches) {
        const k = key(fiche)
        const list = groups.get(k)
        if (list) list.push(fiche)
        else groups.set(k, [fiche])
    }
    return [...groups].map(([id, list]) => {
        const balles = list.flatMap((f) => f.balles)
        return {
            id,
            kg: poidsInitial(balles),
            fiches: list.length,
            balles: balles.length,
            qualite: qualitePonderee(balles),
            kgParHeure: kgParHeure(list),
            ecarts: ecarts(balles).balles,
        }
    }).sort((a, b) => b.kg - a.kg)
}

/**
 * Par fournisseur, balle par balle : une fiche mêle plusieurs fournisseurs,
 * et c'est la qualité de LEURS balles qui juge chacun. Pas de kg/h — le
 * temps passé appartient à la fiche, il ne se partage pas entre fournisseurs.
 */
function fournisseurStats(balles: readonly FicheTriBalle[]): TriGroupStat[] {
    const groups = new Map<string, FicheTriBalle[]>()
    for (const b of balles) {
        const list = groups.get(b.fournisseur_id)
        if (list) list.push(b)
        else groups.set(b.fournisseur_id, [b])
    }
    return [...groups].map(([id, list]) => ({
        id,
        kg: poidsInitial(list),
        fiches: new Set(list.map((b) => b.fiche_id)).size,
        balles: list.length,
        qualite: qualitePonderee(list),
        kgParHeure: null,
        ecarts: ecarts(list).balles,
    })).sort((a, b) => b.kg - a.kg)
}

export function computeTriAnalytics(fiches: readonly FicheTriComplete[]): TriAnalytics {
    const balles = fiches.flatMap((f) => f.balles)
    const bySortie = kgParSortie(balles)
    const totalReparti = [...bySortie.values()].reduce((s, v) => s + v, 0)

    const weeks = new Map<string, Record<string, number>>()
    for (const fiche of fiches) {
        const week = isoWeekKey(fiche.date_tri)
        const row = weeks.get(week) ?? {}
        for (const [sortieId, kg] of kgParSortie(fiche.balles)) row[sortieId] = (row[sortieId] ?? 0) + kg
        weeks.set(week, row)
    }

    const categories = new Map<string, FicheTriBalle[]>()
    for (const b of balles) {
        const list = categories.get(b.category_id)
        if (list) list.push(b)
        else categories.set(b.category_id, [b])
    }

    return {
        totals: {
            kg: poidsInitial(balles),
            reparti: totalReparti,
            fiches: fiches.length,
            balles: balles.length,
            minutes: fiches.reduce((s, f) => s + (f.duree_minutes ?? 0), 0),
            kgParHeure: kgParHeure(fiches),
            qualite: qualitePonderee(balles),
            ecarts: ecarts(balles),
        },
        parSortie: [...bySortie]
            .map(([sortieId, kg]) => ({ sortieId, kg, pct: totalReparti > 0 ? (kg / totalReparti) * 100 : 0 }))
            .sort((a, b) => b.kg - a.kg),
        parSemaine: [...weeks]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([semaine, kgs]) => ({ semaine, ...kgs })),
        parTrieur: groupStats(fiches, (f) => f.trieur_id),
        parFournisseur: fournisseurStats(balles),
        parCategorie: [...categories]
            .map(([categoryId, list]) => ({
                categoryId,
                kg: poidsInitial(list),
                balles: list.length,
                bySortie: Object.fromEntries(kgParSortie(list)),
                qualite: qualitePonderee(list),
            }))
            .sort((a, b) => b.kg - a.kg),
    }
}

// ── Tendance ─────────────────────────────────────────────────────────────────

/**
 * Période précédente de même durée, juste avant celle des filtres : du 1er au
 * 30 septembre → du 2 au 31 août. Une fin vide vaut aujourd'hui. `null` sans
 * début (« Tout ») : il n'y a rien avant.
 */
export function previousPeriod(
    f: Pick<TriFilters, "dateFrom" | "dateTo">,
    today = new Date(),
): { from: string; to: string } | null {
    if (!f.dateFrom) return null
    const from = parseISO(f.dateFrom)
    const to = f.dateTo ? parseISO(f.dateTo) : today
    const days = differenceInCalendarDays(to, from) + 1
    if (days <= 0) return null
    const prevTo = subDays(from, 1)
    return { from: format(subDays(prevTo, days - 1), "yyyy-MM-dd"), to: format(prevTo, "yyyy-MM-dd") }
}

export interface TriTrend {
    /** Variation relative des kilos triés (0,12 = +12 %). */
    kg: number | null
    /** Variation relative des kg/h. */
    kgParHeure: number | null
    /** Écart absolu de qualité moyenne, en étoiles (+0,2). */
    qualite: number | null
    /** Écart absolu du nombre de balles en écart. */
    ecarts: number | null
}

const relative = (prev: number | null, cur: number | null) =>
    prev === null || cur === null || prev <= 0 ? null : (cur - prev) / prev

/**
 * Évolution des chiffres clés d'une période à la précédente. `null` partout
 * quand la période précédente est vide : comparer à rien ne dit rien.
 */
export function compareTotals(prev: TriAnalytics["totals"], cur: TriAnalytics["totals"]): TriTrend {
    if (prev.fiches === 0) return { kg: null, kgParHeure: null, qualite: null, ecarts: null }
    return {
        kg: relative(prev.kg, cur.kg),
        kgParHeure: relative(prev.kgParHeure, cur.kgParHeure),
        qualite: prev.qualite === null || cur.qualite === null ? null : cur.qualite - prev.qualite,
        ecarts: cur.ecarts.balles - prev.ecarts.balles,
    }
}

// ── Formatage ────────────────────────────────────────────────────────────────

const KG = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })

/** « 1 240,5 kg » ; au-delà de 10 t, « 12,4 t ». */
export function formatKg(kg: number): string {
    return kg >= 10_000 ? `${KG.format(kg / 1000)} t` : `${KG.format(kg)} kg`
}

/** Écart signé : « −4 kg », « +2,5 kg ». */
export function formatEcart(kg: number): string {
    const abs = formatKg(Math.abs(kg))
    return kg < 0 ? `−${abs}` : `+${abs}`
}

/** 150 → « 2 h 30 » ; `null` → « — ». */
export function formatDuree(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return "—"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    if (h === 0) return `${m} min`
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`
}

/** « 08:30 → 11:00 » ; `null` sans horaires. */
export function formatHoraires(debut: string | null, fin: string | null): string | null {
    if (!debut || !fin) return null
    return `${debut.slice(0, 5)} → ${fin.slice(0, 5)}`
}
