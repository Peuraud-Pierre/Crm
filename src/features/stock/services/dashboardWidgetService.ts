// ── services/dashboardWidgetService.ts ────────────────────────────────────────
// Couche service des deux modules de dashboard exposés par la feature stock.
//
// Requêtes dédiées plutôt que réutilisation de `useArrivageManuel` ou
// `useHistory` : ces deux hooks rapatrient l'intégralité de leur table pour
// alimenter un écran paginé côté client. Un module qui affiche cinq lignes
// n'a aucune raison de payer ça au chargement de l'accueil.

import { supabase } from "@/integrations/supabase/client"
import type { ActivityLog } from "../types/history.types"
import type { ArrivageManuelRow } from "../types/arrivage-manuel.types"
import { supabaseArrivage } from "./arrivageService"

/** Statuts considérés comme « en cours » : ni reçus, ni annulés. */
const OPEN_STATUSES = ["planifié", "en_transit", "déchargé"]

/**
 * Les prochains déchargements.
 *
 * Le module ne montre pas « tout ce qui est en cours » mais **ce qui
 * arrive** : les conteneurs dont le déchargement est prévu à partir de
 * maintenant, du plus proche au plus lointain. C'est la même lecture que
 * le tableau — voir `components/flow/ArrivageLimitedTable.tsx`, section
 * « 5 prochains arrivages par date de déchargement prévue », qui filtre
 * déjà sur `prev_dechargement_at >= now` et trie dans le même sens.
 *
 * Conséquence assumée : un arrivage **sans date de déchargement** n'y
 * figure pas, et un arrivage dont la date est passée non plus. C'est ce
 * que « les prochains déchargements » veut dire ; le module l'annonce
 * dans son état vide pour qu'une liste vide ne passe pas pour une panne.
 *
 * Le champ de référence est `prev_dechargement_at` (timestamp unifié,
 * migration `20260526_arrivage_manuel_prev_dechargement.sql`). Attention,
 * `integrations/supabase/types.ts` est en retard dessus et expose encore
 * `prev_dechargement_date`/`_heure`/`_jour` — le type applicatif faisant
 * foi est `types/arrivage-manuel.types.ts`, et le client est de toute
 * façon non typé ici (`supabaseArrivage`).
 *
 * Le fournisseur est résolu **côté client**, en deux requêtes, et non par une
 * ressource incorporée PostgREST : `arrivage_manuel.fournisseur_id` est un
 * UUID nu, sans clé étrangère (`20260521_arrivage_manuel.sql`). Demander
 * l'incorporation échouait en `PGRST200`, et l'erreur passait inaperçue
 * parce que le module la rendait comme un état vide. C'est déjà la
 * convention du module — voir `utils/fournisseurAnalytics.ts` et
 * `components/settings/menus/fournisseurs/FournisseursMenu.tsx`, qui
 * documentent tous deux l'absence de contrainte : un arrivage peut
 * référencer un fournisseur supprimé.
 */
export async function fetchOpenArrivages(
    limit: number,
    /** Fenêtre en jours à partir de maintenant. 0 = pas de borne haute. */
    horizonDays = 0
): Promise<ArrivageManuelRow[]> {
    const now = new Date()

    let query = supabaseArrivage
        .from("arrivage_manuel")
        .select("*")
        .in("status", OPEN_STATUSES)
        .gte("prev_dechargement_at", now.toISOString())

    if (horizonDays > 0) {
        const until = new Date(now)
        until.setDate(until.getDate() + horizonDays)
        query = query.lte("prev_dechargement_at", until.toISOString())
    }

    const { data, error } = await query
        .order("prev_dechargement_at", { ascending: true })
        .limit(limit)

    if (error) throw error

    const rows = (data ?? []) as ArrivageManuelRow[]
    return withFournisseurs(rows)
}

/**
 * Associe à chaque arrivage le fournisseur que son `fournisseur_id` désigne,
 * ou `null` si l'id ne résout pas. Aucune requête quand aucun arrivage n'en
 * porte.
 */
async function withFournisseurs(
    rows: ArrivageManuelRow[]
): Promise<ArrivageManuelRow[]> {
    const ids = [
        ...new Set(
            rows
                .map((row) => row.fournisseur_id)
                .filter((id): id is string => !!id)
        ),
    ]
    if (ids.length === 0) return rows

    const { data, error } = await supabase
        .from("fournisseur_gestion")
        .select("id, name, siege_localisation")
        .in("id", ids)

    if (error) throw error

    const byId = new Map((data ?? []).map((f) => [f.id, f]))
    return rows.map((row) => ({
        ...row,
        fournisseur: row.fournisseur_id
            ? (byId.get(row.fournisseur_id) ?? null)
            : null,
    }))
}

/** Les dernières écritures du journal d'activité, toutes entités confondues. */
export async function fetchRecentActivityLogs(
    limit: number
): Promise<ActivityLog[]> {
    const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data ?? []) as ActivityLog[]
}
