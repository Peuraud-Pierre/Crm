// Couche service de la feature annonces — table public.annonce et bucket
// de stockage `annonces` (docs/Architecture_Feature.pdf §5). Seul endroit
// de la feature autorisé à importer le client Supabase.
import { supabase } from "@/integrations/supabase/client"
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types"
import { ANNOUNCEMENT_BUCKET, ANNOUNCEMENT_IMAGE_MAX_BYTES } from "../constants"
import type {
    Announcement,
    AnnouncementDraft,
} from "../types/announcement.types"

const COLUMNS =
    "id, created_at, titre, type, image, description, link, start_date, " +
    "end_date, archived_at, pinned, target_role_ids, target_service_ids, " +
    "author_id, excerpt, body_markdown, event_date, " +
    // La signature est jointe plutôt que résolue en second appel : le
    // bandeau affiche déjà l'auteur de la une, et une requête par
    // annonce pour un nom et un avatar serait absurde.
    "author:profiles!annonce_author_id_fkey(user_id, full_name, avatar_url)"

/**
 * Annonces visibles par l'appelant.
 *
 * Le filtrage n'est PAS fait ici : il vit dans la policy SELECT
 * (migrations 20260824101000 et 20260824102000). Un utilisateur ordinaire
 * ne reçoit que les annonces en ligne qui le ciblent ; un porteur de
 * `manager.annonce` reçoit tout, y compris brouillons et archives.
 *
 * C'est le point important de la refonte : avant, la requête ramenait la
 * table entière et le tri était fait dans le navigateur — les annonces
 * non encore publiées descendaient chez tous les clients.
 */
export async function fetchAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
        .from("annonce")
        .select(COLUMNS)
        .order("pinned", { ascending: false })
        .order("start_date", { ascending: false })

    if (error) throw error
    return (data ?? []) as unknown as Announcement[]
}

// Les colonnes de l'article — author_id, excerpt, body_markdown,
// event_date — sont créées par la migration 20260825120000 mais absentes
// de `types.ts`, qui est généré et n'a pas encore été régénéré (il faut
// un accès à la base). Les deux transtypages ci-dessous disparaissent au
// prochain `supabase gen types`.
export async function insertAnnouncement(
    draft: AnnouncementDraft
): Promise<void> {
    const { error } = await supabase
        .from("annonce")
        .insert(draft as unknown as TablesInsert<"annonce">)
    if (error) throw error
}

export async function updateAnnouncement(
    id: string,
    updates: Partial<AnnouncementDraft>
): Promise<void> {
    const { error } = await supabase
        .from("annonce")
        .update(updates as unknown as TablesUpdate<"annonce">)
        .eq("id", id)
    if (error) throw error
}

export async function deleteAnnouncement(id: string): Promise<void> {
    // L'image est relevée AVANT la suppression : après, plus rien ne
    // pointe dessus et l'objet resterait dans le bucket pour toujours.
    // La migration 20260824105000 a sorti les images de la colonne `jsonb`
    // à cause de leur poids ; les accumuler un étage plus bas rejouerait
    // le même problème.
    const { data } = await supabase
        .from("annonce")
        .select("image")
        .eq("id", id)
        .maybeSingle()

    const { error } = await supabase.from("annonce").delete().eq("id", id)
    if (error) throw error

    await discardAnnouncementImage(data?.image)
}

/**
 * Archive (masquage réversible) ou désarchive une annonce.
 * Contrairement à la suppression, la ligne reste en base.
 */
export async function setAnnouncementArchived(
    id: string,
    archived: boolean
): Promise<void> {
    const { error } = await supabase
        .from("annonce")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id)

    if (error) throw error
}

/* ============================
   Image
============================ */

/**
 * Téléverse une image et renvoie son chemin dans le bucket.
 *
 * Le nom est préfixé d'un horodatage pour éviter les collisions tout en
 * restant lisible dans la console Supabase (même parti pris que le
 * nommage par slug de `bibliothequeService.ts`).
 */
export async function uploadAnnouncementImage(file: File): Promise<string> {
    if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
        throw new Error(
            `Image trop lourde : ${(file.size / 1024 / 1024).toFixed(1)} Mo pour un maximum de ${ANNOUNCEMENT_IMAGE_MAX_BYTES / 1024 / 1024} Mo.`
        )
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`

    const { error } = await supabase.storage
        .from(ANNOUNCEMENT_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false })

    if (error) throw error
    return path
}

export async function removeAnnouncementImage(path: string): Promise<void> {
    const { error } = await supabase.storage
        .from(ANNOUNCEMENT_BUCKET)
        .remove([path])

    if (error) throw error
}

/**
 * Supprime l'objet du bucket si `image` en désigne un — sans jamais faire
 * échouer l'appelant.
 *
 * Deux raisons de ne pas propager l'erreur. La forme d'abord : `image`
 * peut être une data-URL ou une URL absolue héritée (voir
 * `resolveAnnouncementImage`), qui ne correspond à aucun objet. Le moment
 * ensuite : le nettoyage suit toujours l'opération utile — la ligne est
 * déjà supprimée, la nouvelle image déjà téléversée. Échouer ici ne
 * rendrait rien à l'utilisateur, ça ne ferait qu'annuler à ses yeux une
 * action qui a bien eu lieu. Le pire cas reste un objet orphelin.
 */
export async function discardAnnouncementImage(
    // `unknown` et non `string | null` : la colonne est typée `Json` côté
    // Supabase, et les annonces historiques y ont mis autre chose qu'un
    // chemin. La forme est vérifiée ici, une fois.
    image: unknown
): Promise<void> {
    if (typeof image !== "string") return
    if (!image || image.startsWith("data:") || image.startsWith("http")) return

    try {
        await removeAnnouncementImage(image)
    } catch (err) {
        console.error("[announcementService] image orpheline:", image, err)
    }
}

/**
 * URL affichable d'une image d'annonce.
 *
 * Accepte les deux formes qui coexistent volontairement en base :
 *   - une data-URL (`data:image/...`) ou une URL absolue → annonce
 *     historique, rendue telle quelle ;
 *   - un chemin → nouvelle annonce, résolue dans le bucket public.
 *
 * Cette double lecture est ce qui permet de basculer vers le stockage
 * objet sans reprise de données (cf. migration 20260824105000).
 */
export function resolveAnnouncementImage(
    image: string | null | undefined
): string | null {
    if (!image) return null
    if (image.startsWith("data:") || image.startsWith("http")) return image

    return supabase.storage.from(ANNOUNCEMENT_BUCKET).getPublicUrl(image).data
        .publicUrl
}

/* ============================
   Audience (ciblage)
============================ */

// Le référentiel rôles/services a été promu dans `shared/services` : il
// sert aussi aux gabarits de dashboard (réutilisation prouvée, §4).
export {
    fetchAudienceOptions,
    type AudienceOption,
} from "@/shared/services/audienceService"
