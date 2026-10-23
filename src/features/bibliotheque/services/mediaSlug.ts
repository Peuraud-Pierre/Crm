// ── services/mediaSlug.ts ──────────────────────────────────────────────────────
// RÔLE : Utilitaires bas niveau de génération/vérification de slug de fichier
// pour le bucket Supabase Storage 'bibliotheque', partagés par
// bibliothequeMediaService.ts (upload/renommage optimistes) et
// bibliothequeMediaConflict.ts (résolution de conflit détecté en base).
//
// Extrait dans un fichier séparé (plutôt que défini dans l'un des deux et
// importé par l'autre) pour éviter une dépendance circulaire entre ces deux
// fichiers : bibliothequeMediaConflict.ts a besoin de ces helpers, et
// bibliothequeMediaService.ts n'a aucune raison de dépendre en retour de
// bibliothequeMediaConflict.ts. Un module neutre, importé par les deux mais
// n'important aucun des deux, garde le graphe de dépendances acyclique.
//
// Ce fichier ne sait rien de React ni des tables métier bibliotheque_* — sauf
// pour findTakenPaths, qui lit la colonne image_url/icon_url de
// bibliotheque_thematiques (nécessaire à l'anti-collision de slug elle-même).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - services/bibliothequeMediaService.ts → upload/renommage optimistes
//   - services/bibliothequeMediaConflict.ts → relocalisation sur conflit DB

import { supabase as db } from "@/integrations/supabase/client"
import { TABLE_NAMES } from "./mappers"
import { throwIfError } from "./errors"

export const BIBLIOTHEQUE_BUCKET = "bibliotheque"

// Vérifie en UNE SEULE requête lesquels des chemins `paths` sont déjà utilisés
// par une AUTRE thématique (excludeId exclut la thématique courante). Utilisé
// par findFreeSlugBatched pour tester tout un LOT de slugs candidats d'un coup
// plutôt qu'un aller-retour réseau par slug essayé (voir son commentaire pour
// le scénario que ça évite : renommages en rafale vers un même nom très
// fréquent, ex. "Livraison").
// `Promise<Set<string>>` : un Set est une collection de valeurs qui ne peut
// jamais contenir de doublon, avec une méthode .has(valeur) très rapide pour
// tester "est-ce que cette valeur est dedans ?" — pratique ici pour tester
// vite si un chemin est déjà pris, sans faire de boucle.
async function findTakenPaths(
    paths: string[],
    excludeId: string | undefined,
    column: "image_url" | "icon_url",
): Promise<Set<string>> {
    if (paths.length === 0) return new Set()
    let query = db.from(TABLE_NAMES.thematiques).select(column).in(column, paths)
    if (excludeId) query = query.neq("id", excludeId)
    // Destructuring : `const { data, error } = await query` extrait directement
    // les champs `data` et `error` de l'objet renvoyé par Supabase, plutôt que
    // d'écrire `const result = await query; const data = result.data; ...`.
    const { data, error } = await query
    throwIfError("findTakenPaths", error)
    const rows = (data ?? []) as unknown as Array<{ image_url?: string | null; icon_url?: string | null }>
    // `.filter((v): v is string => !!v)` est un "type guard" (garde de type) :
    // en plus de filtrer les valeurs vides (null/undefined/"" via !!v), cette
    // écriture "v is string" dit à TypeScript "après ce filtre, fais confiance,
    // le tableau ne contient plus que des string" (sans ça, il resterait
    // typé `(string | null | undefined)[]`).
    return new Set(rows.map((r) => r[column]).filter((v): v is string => !!v))
}

// Nettoie une extension candidate : seul le label passait par slugify()
// jusqu'ici, pas l'extension — un nom de fichier fabriqué (ex:
// "a.png/../../icons/evil") pouvait donc injecter "/" ou ".." dans le chemin
// final. On restreint aux caractères [a-z0-9], tronqués à 8 caractères
// (largement suffisant pour jpg/jpeg/png/webp/gif/svg...).
export function sanitizeExt(rawExt: string, fallback: string): string {
    const cleaned = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)
    return cleaned || fallback
}

// Extrait l'extension d'un nom de fichier (après le dernier point). Un nom
// sans point (ex: "photo") n'a PAS d'extension — contrairement à
// `name.split(".").pop()`, qui renvoie alors le nom entier tel quel et
// empêche sanitizeExt() de retomber sur son fallback.
export function extractExt(filename: string): string {
    const dotIndex = filename.lastIndexOf(".")
    return dotIndex === -1 ? "" : filename.slice(dotIndex + 1)
}

// Nombre de slugs candidats vérifiés en une seule requête `IN (...)`. Dans le
// cas courant (0 collision), une seule requête de ce lot suffit de toute façon
// (le premier candidat, `baseSlug` ou `baseSlug-attempt`, est libre). Ce n'est
// que dans le cas rafale (plusieurs noms déjà pris, ex. renommages concurrents
// vers un nom très fréquent) que la taille du lot réduit le nombre total de
// requêtes : ceil(collisions / SLUG_SEARCH_BATCH_SIZE) au lieu d'une requête
// par tentative.
const SLUG_SEARCH_BATCH_SIZE = 8

// Cherche un slug libre en vérifiant un LOT de candidats par requête, plutôt
// qu'un slug (donc un aller-retour réseau) à la fois. `makeSlug(attempt)`
// génère le slug candidat pour un numéro de tentative donné — la numérotation
// diffère selon l'appelant (resolveAvailableSlug, dans bibliothequeMediaService.ts,
// part de la forme nue `baseSlug` ; relocateThematiqueMedia, dans
// bibliothequeMediaConflict.ts, part toujours d'un suffixe), d'où cette
// indirection plutôt qu'une convention `${baseSlug}-${n}` figée ici.
//
// Ce check est un SELECT en base — non-atomique vis-à-vis d'un upload
// concurrent (deux créations de thématiques au même nom peuvent toutes deux
// passer ce check avant que l'une ou l'autre n'ait téléversé). Pour le cas
// upload, le véritable verrou anti-collision est l'upload lui-même (upsert:
// false, voir uploadWithCollisionRetry dans bibliothequeMediaService.ts) : ce
// SELECT ne sert qu'à éviter de partir sur un slug déjà pris par une AUTRE
// thématique existante (cas de renommage). Pour le cas écriture DB
// (insert/update de la ligne thématique), c'est désormais l'index UNIQUE
// partiel en base (migration 20260720130000_bibliotheque_thematiques_media_unique.sql)
// qui garantit l'atomicité réelle — voir bibliothequeMediaConflict.ts.
// `makeSlug` et `buildPath` sont des paramètres de type fonction (des
// "callbacks") : au lieu de passer une valeur, l'appelant passe une fonction
// que findFreeSlugBatched appellera lui-même au bon moment. Ça permet de
// réutiliser cette même fonction générique pour des cas où la façon de
// générer un slug candidat (makeSlug) ou son chemin final (buildPath) diffère.
export async function findFreeSlugBatched(
    startAttempt: number,
    makeSlug: (attempt: number) => string,
    excludeId: string | undefined,
    column: "image_url" | "icon_url",
    buildPath: (slug: string) => string,
): Promise<string> {
    let attempt = startAttempt
    // `while (true)` est une boucle infinie : elle ne s'arrête que grâce au
    // `return` à l'intérieur (dès qu'un slug libre est trouvé). Pas de risque
    // de boucle infinie réelle ici : à chaque tour, on avance vers des slugs
    // jamais essayés, donc un slug libre finit toujours par être trouvé.
    while (true) {
        // `Array.from({ length: N }, callback)` construit un tableau de N
        // éléments en appelant `callback(valeurIgnorée, index)` pour chacun —
        // un raccourci pratique pour générer une liste de valeurs calculées
        // sans créer de tableau vide à remplir dans une boucle for classique.
        const candidates = Array.from({ length: SLUG_SEARCH_BATCH_SIZE }, (_, i) => makeSlug(attempt + i))
        const paths = candidates.map(buildPath)
        const taken = await findTakenPaths(paths, excludeId, column)
        const freeIndex = paths.findIndex((p) => !taken.has(p))
        if (freeIndex !== -1) return candidates[freeIndex]
        attempt += SLUG_SEARCH_BATCH_SIZE
    }
}
