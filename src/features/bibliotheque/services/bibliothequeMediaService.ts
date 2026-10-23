// ── services/bibliothequeMediaService.ts ──────────────────────────────────────
// RÔLE : Couche service — toutes les opérations Supabase Storage pour les
// médias de thématique (bucket public 'bibliotheque').
//
// Extrait de bibliothequeService.ts (qui dépassait le seuil de 400 lignes,
// voir Architecture_Feature.pdf §15) pour séparer deux responsabilités
// distinctes : bibliothequeService.ts fait le CRUD des 4 tables, ce fichier
// fait tout ce qui touche à Supabase Storage (upload, renommage, suppression,
// résolution d'URL).
//
// La détection/relocalisation en cas de conflit détecté au niveau base de
// données (detectMediaConflict/relocateThematiqueMedia) est une responsabilité
// distincte, extraite dans bibliothequeMediaConflict.ts (ce fichier approchait
// à nouveau le même seuil de 400 lignes) — bibliothequeService.ts l'importe
// désormais directement, ce fichier ne la réexporte plus. Les deux fichiers
// partagent leurs helpers bas niveau (BIBLIOTHEQUE_BUCKET, sanitizeExt,
// extractExt, findFreeSlugBatched) via mediaSlug.ts plutôt que l'un
// n'important l'autre, pour ne pas créer de dépendance circulaire entre eux.
//
// Ce fichier ne sait rien de React (pas de useState, pas d'effets) ni des
// tables SQL bibliotheque_* — seulement du bucket Storage et, pour les
// vérifications anti-collision, de la colonne image_url/icon_url de
// bibliotheque_thematiques.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - services/bibliothequeService.ts → orchestration create/update thématique
//   - hooks/data/useBibli.ts   → upload direct depuis le formulaire

import { supabase } from "@/integrations/supabase/client"
import { safeRandomUUID } from "@/shared/lib/uuid"
import { slugify } from "../utils"
import { throwIfError } from "./errors"
import { BIBLIOTHEQUE_BUCKET, sanitizeExt, extractExt, findFreeSlugBatched } from "./mediaSlug"

// baseSlug, puis baseSlug-2, baseSlug-3... — voir findFreeSlugBatched (mediaSlug.ts)
// pour le détail du regroupement des vérifications par lot.
async function resolveAvailableSlug(
    baseSlug: string,
    excludeId: string | undefined,
    column: "image_url" | "icon_url",
    buildPath: (slug: string) => string,
): Promise<string> {
    return findFreeSlugBatched(
        1,
        (attempt) => (attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`),
        excludeId,
        column,
        buildPath,
    )
}

// Le "?" après un nom de champ (message?, statusCode?) rend ce champ optionnel :
// l'objet peut très bien ne pas l'avoir du tout. Son type devient alors
// "string | undefined" plutôt que juste "string".
interface StorageUploadError {
    message?: string
    statusCode?: string
}

// Un conflit "objet déjà existant" retourné par Storage quand upsert: false —
// signe que deux appels concurrents ont réservé le même chemin avant que l'un
// des deux n'ait fini son upload (ex: deux thématiques créées simultanément
// avec un nom identique). Détection best-effort sur la forme d'erreur connue
// du client Storage Supabase (statusCode 409 / message "already exists").
function isStorageDuplicateError(error: StorageUploadError | null | undefined): boolean {
    if (!error) return false
    return error.statusCode === "409" || /already exists/i.test(error.message ?? "")
}

const MAX_SLUG_COLLISION_RETRIES = 10

// Téléverse vers `buildPath(slug)` avec upsert: false — Storage rejette le
// second appel concurrent sur le MÊME chemin au lieu de l'écraser
// silencieusement (contrairement à upsert: true). Sur un tel conflit, on
// reprend avec le prochain slug jamais essayé plutôt que de perdre le fichier
// de l'autre thématique.
async function uploadWithCollisionRetry(
    label: string,
    excludeId: string | undefined,
    column: "image_url" | "icon_url",
    buildPath: (slug: string) => string,
    doUpload: (path: string) => Promise<{ error: StorageUploadError | null }>,
): Promise<string> {
    const baseSlug = slugify(label) || safeRandomUUID()
    let slug = await resolveAvailableSlug(baseSlug, excludeId, column, buildPath)
    for (let attempt = 0; attempt < MAX_SLUG_COLLISION_RETRIES; attempt++) {
        const path = buildPath(slug)
        const { error } = await doUpload(path)
        if (!error) return path
        if (!isStorageDuplicateError(error)) throwIfError("uploadWithCollisionRetry", error)
        slug = `${baseSlug}-${attempt + 2}`
    }
    throw new Error(`Impossible de trouver un chemin Storage libre pour "${label}" après ${MAX_SLUG_COLLISION_RETRIES} tentatives`)
}

/**
 * Téléverse l'image d'illustration d'une thématique et renvoie son chemin dans
 * le bucket. `excludeId` : id de la thématique en cours d'édition (mode
 * renommage) — son propre fichier existant n'est pas considéré comme une
 * collision. Omis en mode création (aucune ligne en base à exclure).
 */
export async function uploadThematiqueImage(file: File, label: string, excludeId?: string): Promise<string> {
    const ext = sanitizeExt(extractExt(file.name), "jpg")
    return uploadWithCollisionRetry(label, excludeId, "image_url", (s) => `${s}.${ext}`, (path) =>
        supabase.storage.from(BIBLIOTHEQUE_BUCKET).upload(path, file, {
            cacheControl: "3600",
            contentType: file.type || undefined,
            upsert: false,
        })
    )
}

/** Téléverse l'icône SVG d'une thématique et renvoie son chemin dans le bucket. Voir uploadThematiqueImage pour excludeId. */
export async function uploadThematiqueIcon(file: File, label: string, excludeId?: string): Promise<string> {
    return uploadWithCollisionRetry(label, excludeId, "icon_url", (s) => `icons/${s}.svg`, (path) =>
        supabase.storage.from(BIBLIOTHEQUE_BUCKET).upload(path, file, {
            cacheControl: "3600",
            contentType: "image/svg+xml",
            upsert: false,
        })
    )
}

// Renomme (déplace) un média existant en Storage si son chemin ne correspond
// plus au nom actuel de la thématique — appelé quand le label a changé (voir
// syncThematiqueMediaNaming) ou juste après le remplacement d'une image (voir
// replaceThematiqueImage, qui a déjà supprimé l'ancien fichier avant d'appeler
// ceci, libérant le chemin canonique). Ignore les valeurs vides ou qui ne
// sont pas des chemins relatifs au bucket (garde-fou, ne devrait plus arriver).
// N'échoue jamais la sauvegarde : si le déplacement échoue, l'ancien chemin
// est conservé et l'erreur est journalisée par l'appelant.
async function renameMediaIfStale(
    currentPath: string,
    label: string,
    id: string,
    kind: "image" | "icon",
): Promise<string> {
    if (!currentPath) return currentPath
    if (currentPath.startsWith("http://") || currentPath.startsWith("https://") || currentPath.startsWith("/")) {
        return currentPath
    }

    const ext = kind === "icon" ? "svg" : sanitizeExt(extractExt(currentPath), "jpg")
    const column = kind === "icon" ? "icon_url" : "image_url"
    const buildPath = kind === "icon" ? (s: string) => `icons/${s}.svg` : (s: string) => `${s}.${ext}`

    const baseSlug = slugify(label) || safeRandomUUID()
    const targetPath = buildPath(baseSlug)
    if (targetPath === currentPath) return currentPath // déjà synchronisé

    const availableSlug = await resolveAvailableSlug(baseSlug, id, column, buildPath)
    const newPath = buildPath(availableSlug)
    if (newPath === currentPath) return currentPath

    const { error } = await supabase.storage.from(BIBLIOTHEQUE_BUCKET).move(currentPath, newPath)
    if (error) {
        console.error(`[bibliothequeMediaService] renameMediaIfStale (${kind}) move failed:`, error)
        return currentPath
    }
    return newPath
}

/**
 * Resynchronise les noms de fichiers image/icône d'une thématique avec son
 * nom (FR) courant après un renommage. Appelé uniquement si le label a
 * changé (voir useBibli.ts updateThematique) — pas de coût sur une simple
 * sauvegarde sans renommage.
 */
export async function syncThematiqueMediaNaming(
    id: string, label: string, imageUrl: string, iconUrl: string,
): Promise<{ imageUrl: string; iconUrl: string }> {
    const [newImageUrl, newIconUrl] = await Promise.all([
        renameMediaIfStale(imageUrl, label, id, "image"),
        renameMediaIfStale(iconUrl, label, id, "icon"),
    ])
    return { imageUrl: newImageUrl, iconUrl: newIconUrl }
}

/**
 * Résout la valeur stockée en base (image_url / icon_url) en une URL affichable.
 * Certaines thématiques créées avant la migration vers Supabase Storage
 * (20260715120000_bibliotheque_storage.sql) ont encore une URL absolue ou un
 * chemin d'asset statique en base (ex: "/bibliotheque/mon-image.jpg") — ces
 * valeurs ne sont PAS des chemins du bucket et ne doivent pas être passées à
 * getPublicUrl(), qui produirait une URL incorrecte. Même garde-fou que
 * renameMediaIfStale ci-dessus.
 */
export function resolveThematiqueMediaUrl(value?: string | null): string {
    if (!value) return ""
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
        return value
    }
    const { data } = supabase.storage.from(BIBLIOTHEQUE_BUCKET).getPublicUrl(value)
    return data.publicUrl
}

/**
 * Ramène un média déplacé (renameMediaIfStale ou relocateThematiqueMedia) à
 * son ancien chemin — appelé quand le déplacement Storage a réussi mais que
 * l'écriture DB qui devait suivre a ensuite échoué : sans ce rollback, le
 * fichier vivrait au nouveau chemin alors que la base référence encore
 * l'ancien. Best-effort (comme renameMediaIfStale) : n'échoue jamais l'appelant.
 */
export async function revertMediaMove(currentPath: string, previousPath: string): Promise<void> {
    if (!currentPath || !previousPath || currentPath === previousPath) return
    if (previousPath.startsWith("http://") || previousPath.startsWith("https://") || previousPath.startsWith("/")) {
        return
    }
    const { error } = await supabase.storage.from(BIBLIOTHEQUE_BUCKET).move(currentPath, previousPath)
    if (error) {
        console.error("[bibliothequeMediaService] revertMediaMove failed:", error)
    }
}

/**
 * Remplace l'image d'une thématique par un nouveau fichier déjà téléversé
 * pendant la session du dialog (voir uploadThematiqueImage). Appelée au
 * moment de la SOUMISSION du formulaire (pas à la sélection du fichier) :
 *   1. Supprime D'ABORD l'ancienne image (`oldImagePath`) du bucket — libère
 *      le chemin basé sur le nom de la thématique.
 *   2. Renomme ensuite `newImagePath` (téléversé sous un nom temporaire, par
 *      exemple "livraison-2.png", car l'ancien fichier occupait encore
 *      "livraison.png" au moment de l'upload — voir uploadWithCollisionRetry)
 *      vers ce chemin canonique désormais libre.
 * Retourne le chemin final réellement utilisé (peut être identique à
 * `newImagePath` si aucun renommage n'était nécessaire).
 */
export async function replaceThematiqueImage(
    oldImagePath: string,
    newImagePath: string,
    label: string,
    excludeId: string,
): Promise<string> {
    if (oldImagePath && oldImagePath !== newImagePath) {
        await deleteThematiqueMedia(oldImagePath, "")
    }
    return renameMediaIfStale(newImagePath, label, excludeId, "image")
}

/**
 * Supprime du bucket 'bibliotheque' les fichiers image/icône d'une thématique.
 * Appelé après suppression de la ligne bibliotheque_thematiques — best-effort,
 * ne doit pas empêcher la suppression de la thématique si le nettoyage échoue
 * (fichier déjà absent, etc.) : c'est à l'appelant de décider comment traiter
 * une erreur ici (voir useBibli.ts deleteThematique).
 */
export async function deleteThematiqueMedia(imageUrl: string, iconUrl: string): Promise<void> {
    const paths = [imageUrl, iconUrl].filter((p): p is string => !!p)
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(BIBLIOTHEQUE_BUCKET).remove(paths)
    throwIfError("deleteThematiqueMedia", error)
}
