// ── services/packingImportService.ts ──────────────────────────────────────────
// Import d'une packing list : envoi du fichier Excel au service `packing-api`
// (Python/FastAPI, dépôt `packing-api`), qui lit, classe et écrit.
//
// CONTRAT AVEC LE SERVICE
// -----------------------
//   POST ${PUBLIC_PACKING_API_URL}/packing-lists
//   Authorization: Bearer <JWT Supabase de l'utilisateur, session AAL2>
//   multipart/form-data : file (.xlsx), arrivage_manuel_id (uuid)
//
//   201 { packing_list_id, status }
//       status = "a_verifier"    → traitement synchrone terminé
//       status = "echec"         → lignes refusées par la base ; `error_message`
//                                  sur l'en-tête dit pourquoi
//       status = "en_traitement" → traitement asynchrone ; la sheet attend le
//                                  passage à a_verifier | echec par realtime
//   4xx { error, detail }
//       401 → jeton absent ou expiré      403 → session sans MFA, ou pas le droit
//       409 → une packing list existe déjà sur cet arrivage
//       413 → fichier trop volumineux     422 → fichier illisible ou format non reconnu
//
//   GET ${PUBLIC_PACKING_API_URL}/model/stats → `PackingModelStats`
//
// Le client n'affiche que `detail` : c'est lui qui doit porter le message
// lisible par l'utilisateur, `error` restant un code technique.
//
// Le service écrit avec le JWT de l'utilisateur (PostgREST + clé anon), jamais
// en service role : la RLS de `packing_list*`, `imported_by` et l'auteur de
// chaque décision journalisée doivent rester vrais.
//
// CE QUE LE SERVICE ÉCRIT
// -----------------------
// Sur l'en-tête `packing_list` : `source_filename`, `source_sheet` (la feuille
// lue — elle s'appelle « Invoice » sur un conteneur, « Sheet1 » sur le
// suivant), `container_label` (le titre lu en tête, que le front confronte au
// n° de conteneur INTERNE de l'arrivage — `conteneur_no_raw`, « GR 153 » —, par
// présence et non par égalité ; le n° ISO ne sait que confirmer),
// `declared_package_count` (le total de colis
// que le fichier annonce en pied de page) et `classifier_meta` (la trace
// d'audit du classement : seuil, précision mesurée, exemples).
//
// Sur chaque `packing_list_ligne` : `raw_label` tel que lu, `raw_label_key`
// normalisé, `normalizer_version`, `raw_row` complet, `source_row` (n° de
// ligne Excel), les quatre nombres du document — `package_count` (colis),
// `units_per_package`, `unit_kind` ('pcs' | 'kgs') et `declared_total` tel que
// lu, sans recalcul — puis la proposition et sa provenance
// (`suggestion_source`).
//
// LA RÈGLE DE RIGUEUR — amendée, pas assouplie
// --------------------------------------------
// `category_id` n'est pré-rempli que dans deux cas :
//   · correspondance EXACTE du tableau `packing_label_category` (clé ET
//     `normalizer_version` identiques) → `resolution = 'dictionary'` ;
//   · proposition du MODÈLE qui passe sa garde → `resolution = 'model'`.
//     La garde exige ensemble : une confiance au-dessus d'un seuil CALIBRÉ sur
//     la précision que le modèle a réellement eue sur ses propositions passées
//     (98 % sur 50 cas au moins, sinon pas d'auto du tout), un net écart avec
//     la deuxième catégorie, et aucun mot jamais vu — une marque inconnue
//     bloque l'auto.
//
// Tout le reste n'écrit que `suggested_category_id` + `match_confidence`,
// laisse `category_id` NUL et `resolution` NUL : la validation reste fermée
// jusqu'à ce qu'un humain tranche. Mesuré sur deux packings réelles, un
// trigramme à recall utile intervertit les marques (« BRAND FEATHER JACKET » →
// NF FEATHER JACKET) à 0,72-0,84 de confiance, sans qu'un relecteur le voie :
// c'est pour cela que le seuil n'est pas un réglage mais une mesure.
//
// CE QUI FAIT APPRENDRE
// ---------------------
// Chaque UPDATE `resolution = 'human'` de `packingListService` est journalisé
// par trigger dans `packing_label_feedback`, avec la proposition affichée à ce
// moment. Rien à faire côté client. Voir
// `supabase/migrations/20260918100000_stock_packing_learning.sql`.
//
// `reviewed_at` reste nul à l'import : il ne marque que le passage d'un humain.
//
// LA RÉFÉRENCE DE PARSING
// -----------------------
// `utils/packingDocument.ts` et son test `packingDocument.test.ts`, qui tourne
// sur les deux vrais fichiers de `__fixtures__/packing/`. `packing-api` en est
// un portage ligne à ligne et repasse le même corpus (`tests/test_document.py`).
//
// `normalize_packing_label(text)` en base est l'ARBITRE du normaliseur : le
// front (`utils/packingGrouping.ts`) et le service doivent produire la même
// clé, sinon le tableau de correspondance cesse silencieusement de reconnaître.
//
// SANS SERVICE
// ------------
// Sans `PUBLIC_PACKING_API_URL` en développement, l'import passe par
// `packingImportMock.ts`, qui simule ce contrat dans le navigateur (sans
// modèle). En production, l'absence de la variable est une erreur explicite.

import { isDev } from "@/shared/lib/env"
import {
    PackingApiError,
    packingApiAccessToken,
    packingApiBaseUrl,
    packingApiGet,
} from "@/shared/services/packingApiClient"
import type { PackingImportResult, PackingModelStats } from "@/features/stock/types/packing-list.types"

/**
 * Erreur d'import. Sous-classe de `PackingApiError` pour que l'URL de base,
 * l'en-tête d'authentification et la lecture de `detail` vivent dans
 * `shared/services/packingApiClient` — un seul endroit, partagé avec la console
 * de supervision. Les messages restent propres à l'import : « pour importer » dit
 * quelque chose que le message générique ne dit pas.
 */
export class PackingImportError extends PackingApiError {
    constructor(message: string, status: number | null = null) {
        super(message, status)
        this.name = "PackingImportError"
    }
}

/** Vrai quand l'import est simulé localement (dev, sans service configuré). */
export function isPackingImportMocked(): boolean {
    return packingApiBaseUrl() === null && isDev
}

const STATUS_MESSAGES: Record<number, string> = {
    401: "Session expirée — reconnectez-vous pour importer.",
    403: "Vous n'avez pas le droit d'importer une packing list.",
    409: "Cet arrivage a déjà une packing list.",
    413: "Fichier trop volumineux.",
    422: "Fichier illisible ou format de packing list non reconnu.",
}

async function accessToken(): Promise<string> {
    try {
        return await packingApiAccessToken()
    } catch {
        throw new PackingImportError(STATUS_MESSAGES[401], 401)
    }
}

export async function importPackingList(
    file: File,
    arrivageManuelId: string,
): Promise<PackingImportResult> {
    if (isPackingImportMocked()) {
        // Import dynamique : le lecteur Excel ne pèse dans le bundle que
        // lorsqu'on en a besoin, et jamais en production.
        const { mockImportPackingList } = await import("./packingImportMock")
        return mockImportPackingList(file, arrivageManuelId)
    }

    const baseUrl = packingApiBaseUrl()
    if (!baseUrl) {
        throw new PackingImportError("Le service d'import des packing lists n'est pas configuré.")
    }

    const token = await accessToken()

    const body = new FormData()
    body.append("file", file)
    body.append("arrivage_manuel_id", arrivageManuelId)

    let response: Response
    try {
        response = await fetch(`${baseUrl}/packing-lists`, {
            method: "POST",
            body,
            headers: { Authorization: `Bearer ${token}` },
        })
    } catch {
        throw new PackingImportError("Service d'import injoignable. Réessayez dans un instant.")
    }

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: unknown }
        const detail = typeof payload.detail === "string" ? payload.detail : null
        throw new PackingImportError(
            detail ?? STATUS_MESSAGES[response.status] ?? `Erreur du service d'import (${response.status}).`,
            response.status,
        )
    }

    return (await response.json()) as PackingImportResult
}

/**
 * Ce que le modèle a appris. `null` quand aucun service n'est configuré
 * (faux import de dev) : il n'y a alors pas de modèle à décrire.
 */
export async function fetchPackingModelStats(
    signal?: AbortSignal,
): Promise<PackingModelStats | null> {
    if (!packingApiBaseUrl()) return null
    return packingApiGet<PackingModelStats>("/model/stats", signal)
}
