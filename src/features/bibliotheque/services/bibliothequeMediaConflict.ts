// ── services/bibliothequeMediaConflict.ts ─────────────────────────────────────
// RÔLE : Détection et résolution d'un conflit de média détecté au niveau base
// de données (garde-fou atomique), pour les thématiques de la Bibliothèque.
//
// Extrait de bibliothequeMediaService.ts (qui approchait le seuil de 400
// lignes, voir Architecture_Feature.pdf §15) — responsabilité distincte du
// reste de ce fichier (upload/renommage/suppression "optimistes") : ici, on ne
// réagit qu'APRÈS coup, quand la base a refusé une écriture.
//
// Contexte : resolveAvailableSlug (dans bibliothequeMediaService.ts) fait un
// SELECT avant d'agir — non atomique. Pour l'upload d'un NOUVEAU fichier, ce
// n'est pas un problème : le vrai verrou est l'upload Storage lui-même
// (upsert: false, rejeté avec 409 en cas de conflit réel, voir
// uploadWithCollisionRetry). Mais pour un RENOMMAGE (renameMediaIfStale, qui
// utilise Storage.move), il n'existe côté API Storage aucune option
// "upsert: false" équivalente : move() écrase silencieusement la destination
// si elle existe déjà. Deux renommages concurrents vers le même chemin
// peuvent donc, en théorie, faire qu'un fichier écrase l'autre dans le bucket
// sans erreur détectable à ce niveau.
//
// Le filet de sécurité réel est donc posé un cran plus loin, côté base : deux
// index UNIQUE partiels sur bibliotheque_thematiques(image_url) et (icon_url)
// (migration 20260720130000_bibliotheque_thematiques_media_unique.sql)
// garantissent qu'aucune DEUXIÈME ligne ne peut jamais être écrite en base
// avec un chemin déjà référencé par une autre thématique — même si le fichier
// physique a été écrasé dans le bucket. detectMediaConflict() reconnaît
// l'erreur Postgres renvoyée dans ce cas (23505, violation d'unicité) et
// identifie quel champ est en cause ; relocateThematiqueMedia() déplace alors
// le fichier déjà téléversé (par la thématique qui a perdu la course) vers un
// nouveau chemin libre, pour que l'écriture DB puisse être retentée avec un
// chemin réellement disponible. Voir bibliothequeService.ts
// insertThematiqueWithMediaRetry / patchThematiqueWithMediaRetry pour la
// boucle de retry qui orchestre ces deux fonctions.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - services/bibliothequeService.ts → import * as mediaConflict, pour
//     détecter/résoudre un conflit à l'écriture DB (insert/patch thématique)
//
// CE FICHIER IMPORTE :
//   - services/mediaSlug.ts → helpers bas niveau partagés avec
//     bibliothequeMediaService.ts (voir l'en-tête de mediaSlug.ts pour la
//     raison de ce partage via un troisième fichier plutôt qu'un import direct
//     entre bibliothequeMediaService.ts et celui-ci, qui créerait un cycle)

import { supabase } from "@/integrations/supabase/client"
import { safeRandomUUID } from "@/shared/lib/uuid"
import { slugify } from "../utils"
import { throwIfError, BibliothequeServiceError } from "./errors"
import { BIBLIOTHEQUE_BUCKET, findFreeSlugBatched, sanitizeExt, extractExt } from "./mediaSlug"

export interface MediaConflict {
    field: "image" | "icon"
}

interface PostgresUniqueViolationError {
    code?: string
    details?: string | null
    message?: string
}

/**
 * Reconnaît une violation d'unicité Postgres (23505) sur l'un des deux index
 * bibliotheque_thematiques_image_url_uidx / bibliotheque_thematiques_icon_url_uidx
 * et indique quel champ (image ou icône) est en cause, en lisant le nom de
 * colonne renvoyé par Postgres dans `details` (ex: "Key (image_url)=(...)
 * already exists."). Retourne `null` pour toute autre erreur — auquel cas
 * l'appelant doit la propager sans tenter de retry.
 *
 * `error` peut être soit l'erreur Postgres brute, soit une BibliothequeServiceError
 * qui l'enveloppe (voir errors.ts) — insertThematique/patchThematique lèvent
 * désormais systématiquement cette dernière, on déballe donc `.cause` avant
 * d'inspecter `.code`/`.details`.
 */
export function detectMediaConflict(error: unknown): MediaConflict | null {
    const raw = error instanceof BibliothequeServiceError ? error.cause : error
    if (!raw || typeof raw !== "object") return null
    const e = raw as PostgresUniqueViolationError
    if (e.code !== "23505") return null
    const details = e.details ?? e.message ?? ""
    if (details.includes("(image_url)")) return { field: "image" }
    if (details.includes("(icon_url)")) return { field: "icon" }
    return null
}

/**
 * Déplace un média déjà téléversé (currentPath) vers un nouveau chemin libre,
 * en repartant du numéro de tentative `attempt` (pour ne jamais reproposer un
 * slug déjà essayé par le pré-check optimiste qui a précédé). Utilisé
 * uniquement en réaction à un MediaConflict détecté à l'écriture DB — le
 * fichier existe déjà en Storage (téléversé par uploadThematiqueImage/Icon
 * avant l'appel à insert/patch), il n'y a donc pas besoin du File original,
 * juste besoin de le renommer vers un chemin que la base acceptera.
 */
export async function relocateThematiqueMedia(
    currentPath: string,
    label: string,
    excludeId: string | undefined,
    kind: "image" | "icon",
    attempt: number,
): Promise<string> {
    const column = kind === "icon" ? "icon_url" : "image_url"
    const ext = kind === "icon" ? "svg" : sanitizeExt(extractExt(currentPath), "jpg")
    const buildPath = kind === "icon" ? (s: string) => `icons/${s}.svg` : (s: string) => `${s}.${ext}`
    const baseSlug = slugify(label) || safeRandomUUID()

    const slug = await findFreeSlugBatched(attempt, (n) => `${baseSlug}-${n}`, excludeId, column, buildPath)
    const newPath = buildPath(slug)

    const { error } = await supabase.storage.from(BIBLIOTHEQUE_BUCKET).move(currentPath, newPath)
    throwIfError("relocateThematiqueMedia", error)
    return newPath
}
