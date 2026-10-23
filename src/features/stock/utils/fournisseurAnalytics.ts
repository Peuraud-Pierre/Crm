import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { referenceArrivageManuel } from "@/features/stock/types/arrivage-manuel.types"
import type { ArrivageStatus, Fournisseur } from "@/features/stock/types/stock.types"
import { FOURNISSEUR_INACTIVE_DAYS } from "@/features/stock/constants"

export interface FournisseurStats {
    fournisseur_id: string
    name: string
    /** Date de création du fournisseur ; null s'il n'existe plus au référentiel. */
    createdAt: string | null
    arrivageCount: number
    weightKg: number
    qty: number
    /** Part du nombre d'arrivages de la période, en %. */
    sharePct: number
    /** Date de référence du dernier arrivage, toutes périodes confondues. */
    lastArrivageAt: string | null
    byStatus: Record<ArrivageStatus, number>
}

export interface FournisseurAnalytics {
    totals: {
        arrivages: number
        weightKg: number
        qty: number
        /** Fournisseurs ayant au moins un arrivage sur la période. */
        activeFournisseurs: number
        /** Fournisseurs sans arrivage depuis FOURNISSEUR_INACTIVE_DAYS (toutes périodes). */
        inactiveFournisseurs: number
    }
    /** Trié par nombre d'arrivages décroissant. */
    perFournisseur: FournisseurStats[]
    statusBreakdown: { status: ArrivageStatus; count: number }[]
}

const MS_PER_DAY = 86_400_000

export const ARRIVAGE_STATUSES: ArrivageStatus[] = [
    "planifié", "en_transit", "déchargé", "reçu", "annulé",
]

function emptyStatusMap(): Record<ArrivageStatus, number> {
    return { planifié: 0, en_transit: 0, déchargé: 0, reçu: 0, annulé: 0 }
}

/**
 * Date à laquelle rattacher un arrivage. On réutilise la cascade métier
 * (déchargement prévu → arrivée au port → départ) et on retombe sur
 * `created_at`, toujours présent, pour ne perdre aucune ligne.
 */
export function arrivageDate(row: ArrivageManuelRow): string {
    return referenceArrivageManuel(row) ?? row.created_at
}

function inRange(value: string, from: string, to: string): boolean {
    // Bornes optionnelles, au format "YYYY-MM-DD" du champ date natif. La
    // comparaison lexicographique suffit sur des ISO, mais l'heure présente
    // sur `value` ferait échouer la borne haute : on tronque à la journée.
    const day = value.slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
}

export function computeFournisseurAnalytics(
    rows: ArrivageManuelRow[],
    fournisseurs: Fournisseur[],
    range: { from: string; to: string },
    now: Date = new Date(),
): FournisseurAnalytics {
    const byId = new Map(fournisseurs.map((f) => [f.id, f]))

    const stats = new Map<string, FournisseurStats>()
    const ensure = (id: string): FournisseurStats => {
        const existing = stats.get(id)
        if (existing) return existing
        const known = byId.get(id)
        const created: FournisseurStats = {
            fournisseur_id: id,
            name: known?.name ?? "Fournisseur inconnu",
            createdAt: known?.created_at ?? null,
            arrivageCount: 0,
            weightKg: 0,
            qty: 0,
            sharePct: 0,
            lastArrivageAt: null,
            byStatus: emptyStatusMap(),
        }
        stats.set(id, created)
        return created
    }
    for (const f of fournisseurs) ensure(f.id)

    const statusCounts = emptyStatusMap()
    let totalArrivages = 0
    let totalWeight = 0
    let totalQty = 0

    for (const row of rows) {
        if (!row.fournisseur_id) continue
        const entry = ensure(row.fournisseur_id)
        const date = arrivageDate(row)

        // La fraîcheur se mesure sur tout l'historique, pas sur la période
        // filtrée : un fournisseur reste « actif » même si la fenêtre affichée
        // ne le couvre pas.
        if (!entry.lastArrivageAt || date > entry.lastArrivageAt) {
            entry.lastArrivageAt = date
        }

        if (!inRange(date, range.from, range.to)) continue

        entry.arrivageCount += 1
        entry.weightKg += row.total_weight_kg ?? 0
        entry.qty      += row.total_qty ?? 0
        entry.byStatus[row.status] = (entry.byStatus[row.status] ?? 0) + 1

        statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1
        totalArrivages += 1
        totalWeight += row.total_weight_kg ?? 0
        totalQty    += row.total_qty ?? 0
    }

    let activeFournisseurs = 0
    let inactiveFournisseurs = 0
    for (const entry of stats.values()) {
        entry.sharePct = totalArrivages > 0
            ? (entry.arrivageCount / totalArrivages) * 100
            : 0
        // Seuls les fournisseurs encore au référentiel comptent : la tuile les
        // rapporte à `fournisseurs.length`, et un arrivage peut référencer un
        // fournisseur supprimé (`arrivage_manuel.fournisseur_id` n'a pas de clé
        // étrangère) — sans ce filtre, le ratio pourrait dépasser 100 %.
        if (entry.arrivageCount > 0 && entry.createdAt !== null) activeFournisseurs += 1
        if (isDormant(entry, now)) inactiveFournisseurs += 1
    }

    const perFournisseur = [...stats.values()].sort(
        (a, b) => b.arrivageCount - a.arrivageCount || a.name.localeCompare(b.name, "fr"),
    )

    return {
        totals: {
            arrivages: totalArrivages,
            weightKg: totalWeight,
            qty: totalQty,
            activeFournisseurs,
            inactiveFournisseurs,
        },
        perFournisseur,
        statusBreakdown: ARRIVAGE_STATUSES
            .map((status) => ({ status, count: statusCounts[status] }))
            .filter((entry) => entry.count > 0),
    }
}

/**
 * Un fournisseur est dormant s'il n'a pas eu d'arrivage depuis la fenêtre — et
 * seulement s'il est lui-même assez ancien pour qu'on ait pu en attendre un.
 * Sans cette seconde condition, un fournisseur créé le jour même apparaîtrait
 * immédiatement comme dormant.
 */
function isDormant(entry: FournisseurStats, now: Date): boolean {
    const threshold = now.getTime() - FOURNISSEUR_INACTIVE_DAYS * MS_PER_DAY

    if (!entry.lastArrivageAt) {
        const created = entry.createdAt ? Date.parse(entry.createdAt) : Number.NaN
        // Fournisseur inconnu du référentiel (id orphelin) : jamais dormant,
        // il n'y a rien à nettoyer côté paramètres.
        if (Number.isNaN(created)) return false
        return created < threshold
    }

    const last = Date.parse(entry.lastArrivageAt)
    return Number.isNaN(last) || last < threshold
}

/** Fournisseurs sans arrivage récent, les plus anciens d'abord. */
export function inactiveFournisseurs(
    perFournisseur: FournisseurStats[],
    now: Date = new Date(),
): FournisseurStats[] {
    return perFournisseur
        .filter((entry) => isDormant(entry, now))
        .sort((a, b) => {
            if (!a.lastArrivageAt) return -1
            if (!b.lastArrivageAt) return 1
            return a.lastArrivageAt.localeCompare(b.lastArrivageAt)
        })
}

/** Tonnage lisible : 12 480 kg → « 12,5 t ». */
export function formatTonnage(weightKg: number): string {
    if (weightKg < 1000) return `${Math.round(weightKg)} kg`
    return `${(weightKg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`
}
