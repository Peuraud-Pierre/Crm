// ── services/packingAdminService.ts ───────────────────────────────────────────
// Ce que la console lit DIRECTEMENT en base, sans passer par `packing-api`.
//
// Pourquoi certaines lectures ne passent pas par le service : l'historique des
// imports, les décisions humaines et le dictionnaire sont déjà en base et déjà
// gardés par la RLS `stock.packing.view`. Les faire relayer par `packing-api`
// n'ajouterait qu'un intermédiaire à maintenir. Le service n'est interrogé que
// pour ce que lui seul sait : son état, et ce que son modèle calcule.
//
// LECTURE SEULE, INTÉGRALEMENT. Une console de supervision ne modifie rien : les
// corrections se font là où le travail se fait (la sheet de revue, le tableau de
// correspondances de Paramètres), avec la traçabilité qui va avec.
//
// Le cast `supabasePacking` et les noms de tables viennent de
// `features/stock/services/packingListService` — source unique, tant que les
// migrations 20260917*/20260918* ne sont pas appliquées et que `types.ts` ne
// connaît pas ces tables.

import {
    PACKING_TABLES,
    supabasePacking,
} from "@/features/stock/services/packingListService"
import { MISTAKES_WINDOW_DAYS } from "@/features/packing-admin/constants"
import type {
    PackingDictionaryConflict,
    PackingImportRow,
    PackingModelMiss,
} from "@/features/packing-admin/types"

/**
 * Une table absente n'est pas une panne : c'est une migration pas encore
 * appliquée, et l'écran doit le dire plutôt que de se casser.
 *
 * `42P01` est le code Postgres « relation inexistante » ; PostgREST le relaie
 * tel quel. Au 2026-09-21, `packing_label_feedback` n'existe ni en dev ni en
 * prod (migration 20260918100000 non appliquée) — cette classe d'erreur est donc
 * le cas NORMAL au premier lancement, pas un accident.
 */
export class PackingTableMissingError extends Error {
    constructor(readonly table: string) {
        super(
            `La table « ${table} » n'existe pas encore : la migration correspondante n'est pas appliquée.`,
        )
        this.name = "PackingTableMissingError"
    }
}

const MISSING_RELATION = "42P01"

function rethrow(table: string, error: { code?: string } | null): never {
    if (error?.code === MISSING_RELATION) throw new PackingTableMissingError(table)
    throw error
}

const toNumber = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value)

// ─── Historique des imports ───────────────────────────────────────────────────

interface RawHeader {
    id: string
    arrivage_manuel_id: string
    container_label: string | null
    source_filename: string | null
    status: string
    error_message: string | null
    imported_at: string
    imported_by: string | null
    classifier_meta: Record<string, unknown> | null
}

/**
 * Lit la répartition des lignes dans `classifier_meta`.
 *
 * Le jsonb est écrit par le service et peut donc évoluer sans que le front le
 * sache : chaque champ est lu défensivement plutôt que casté. Un import d'avant
 * l'apprentissage n'en porte aucun — d'où `null` et non des zéros, qui
 * laisseraient croire que rien n'avait été reconnu.
 */
function readLines(meta: Record<string, unknown> | null): PackingImportRow["lines"] {
    const lines = meta?.lines
    if (!lines || typeof lines !== "object") return null
    const bag = lines as Record<string, unknown>
    return {
        dictionary: Number(bag.dictionary ?? 0),
        model: Number(bag.model ?? 0),
        suggested: Number(bag.suggested ?? 0),
        none: Number(bag.none ?? 0),
    }
}

export async function fetchImportHistory(limit: number): Promise<PackingImportRow[]> {
    const { data, error } = await supabasePacking
        .from(PACKING_TABLES.header)
        .select(
            "id,arrivage_manuel_id,container_label,source_filename,status,error_message,imported_at,imported_by,classifier_meta",
        )
        .order("imported_at", { ascending: false })
        .limit(limit)

    if (error) rethrow(PACKING_TABLES.header, error)

    return ((data ?? []) as RawHeader[]).map((row) => ({
        id: row.id,
        arrivage_manuel_id: row.arrivage_manuel_id,
        container_label: row.container_label,
        source_filename: row.source_filename,
        status: row.status as PackingImportRow["status"],
        error_message: row.error_message,
        imported_at: row.imported_at,
        imported_by: row.imported_by,
        lines: readLines(row.classifier_meta),
        threshold: toNumber(row.classifier_meta?.threshold),
    }))
}

// ─── Là où le modèle se trompe ────────────────────────────────────────────────

interface RawFeedback {
    packing_list_ligne_id: string
    packing_list_id: string
    raw_label_key: string
    category_id: string
    suggested_category_id: string | null
    suggestion_source: string | null
    suggested_confidence: number | string | null
    decision: string
    decided_by: string | null
    created_at: string
}

/**
 * Les libellés où l'humain a contredit la proposition du modèle.
 *
 * Le filtre final se fait ici et non en SQL : PostgREST ne sait pas comparer
 * deux COLONNES entre elles (`category_id <> suggested_category_id`). On restreint
 * donc en base à ce qui est comparable — propositions du modèle, décisions
 * explicites, fenêtre de temps — et on tranche l'égalité en mémoire. Le volume
 * est celui des décisions humaines sur un mois, pas celui d'une table de faits.
 */
export async function fetchModelMisses(
    windowDays: number = MISTAKES_WINDOW_DAYS,
): Promise<PackingModelMiss[]> {
    const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()

    const { data, error } = await supabasePacking
        .from(PACKING_TABLES.feedback)
        .select(
            "packing_list_ligne_id,packing_list_id,raw_label_key,category_id,suggested_category_id,suggestion_source,suggested_confidence,decision,decided_by,created_at",
        )
        .eq("suggestion_source", "model")
        .eq("decision", "explicit")
        .gte("created_at", since)
        .order("created_at", { ascending: false })

    if (error) rethrow(PACKING_TABLES.feedback, error)

    return ((data ?? []) as RawFeedback[])
        .filter((row) => row.suggested_category_id !== null && row.category_id !== row.suggested_category_id)
        .map((row) => ({
            packing_list_ligne_id: row.packing_list_ligne_id,
            packing_list_id: row.packing_list_id,
            raw_label_key: row.raw_label_key,
            category_id: row.category_id,
            suggested_category_id: row.suggested_category_id,
            suggested_confidence: toNumber(row.suggested_confidence),
            // Le feedback ne conserve pas la `resolution` affichée ; la ligne la
            // porte encore. Renseigné par `attachAutoFlags` quand on la lit.
            was_auto: false,
            decided_by: row.decided_by,
            created_at: row.created_at,
        }))
}

/**
 * Marque les écarts qui étaient des auto-classements — les seuls passés SANS
 * regard humain, et donc les seuls vraiment graves.
 *
 * `packing_list_ligne.resolution` vaut `'human'` après correction : l'information
 * « c'était une auto » ne s'y lit plus. On la retrouve dans `classifier_meta` de
 * l'en-tête ? Non : elle y est agrégée. Le signal exploitable est la confiance
 * enregistrée au moment de la décision, comparée au seuil qui était en vigueur :
 * au-dessus, la garde avait laissé passer.
 */
export function attachAutoFlags(
    misses: PackingModelMiss[],
    thresholdByPacking: Map<string, number | null>,
): PackingModelMiss[] {
    return misses.map((miss) => {
        const threshold = thresholdByPacking.get(miss.packing_list_id) ?? null
        return {
            ...miss,
            was_auto:
                threshold !== null &&
                miss.suggested_confidence !== null &&
                miss.suggested_confidence >= threshold,
        }
    })
}

// ─── Correspondances contredites ──────────────────────────────────────────────

interface RawDictionary {
    raw_label_key: string
    raw_label_sample: string
    category_id: string
    hit_count: number
}

/**
 * Entrées du dictionnaire qu'une décision humaine plus récente contredit.
 *
 * C'est le panneau qui compte le plus dans la durée : le dictionnaire ne
 * reconnaît que des libellés IDENTIQUES, donc une erreur apprise une fois se
 * répète telle quelle sur tous les conteneurs suivants, sans jamais se corriger
 * d'elle-même. Rien d'autre ne la signale.
 */
export async function fetchDictionaryConflicts(): Promise<PackingDictionaryConflict[]> {
    const [dictionary, decisions] = await Promise.all([
        supabasePacking
            .from(PACKING_TABLES.dictionary)
            .select("raw_label_key,raw_label_sample,category_id,hit_count"),
        supabasePacking
            .from(PACKING_TABLES.feedback)
            .select("raw_label_key,category_id,created_at")
            .eq("decision", "explicit")
            .order("created_at", { ascending: false }),
    ])

    if (dictionary.error) rethrow(PACKING_TABLES.dictionary, dictionary.error)
    if (decisions.error) rethrow(PACKING_TABLES.feedback, decisions.error)

    // Première occurrence = la plus récente (tri décroissant côté base).
    const latest = new Map<string, { category_id: string; created_at: string }>()
    for (const row of (decisions.data ?? []) as { raw_label_key: string; category_id: string; created_at: string }[]) {
        if (!latest.has(row.raw_label_key)) latest.set(row.raw_label_key, row)
    }

    const conflicts: PackingDictionaryConflict[] = []
    for (const entry of (dictionary.data ?? []) as RawDictionary[]) {
        const decision = latest.get(entry.raw_label_key)
        if (!decision || decision.category_id === entry.category_id) continue
        conflicts.push({
            raw_label_key: entry.raw_label_key,
            raw_label_sample: entry.raw_label_sample,
            dictionary_category_id: entry.category_id,
            latest_human_category_id: decision.category_id,
            latest_decision_at: decision.created_at,
            hit_count: entry.hit_count,
        })
    }
    return conflicts.sort((a, b) => b.hit_count - a.hit_count)
}
