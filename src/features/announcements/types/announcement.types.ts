import type { Tables } from "@/integrations/supabase/types"
import type { ANNOUNCEMENT_TYPES } from "../constants"

/** Rubrique de l'annonce — contrainte en base par `annonce_type_check`. */
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number]

/**
 * Une annonce telle qu'elle vit en base.
 *
 * Deux écarts assumés par rapport aux types générés :
 *
 * - `type` : `text` en base (le CHECK est `NOT VALID`, des lignes
 *   historiques peuvent en sortir), l'union est rétablie ici comme pour
 *   `ProfileStatus` dans `features/administration/types.ts`.
 * - `image` : la colonne est un `jsonb` — héritage de l'époque où on y
 *   stockait une data-URL base64. Ce qu'on y met est, et n'a jamais été,
 *   qu'une chaîne : soit une data-URL historique, soit un chemin dans le
 *   bucket `annonces`. Voir `resolveAnnouncementImage`.
 */
export type Announcement = Omit<Tables<"annonce">, "type" | "image"> & {
    type: AnnouncementType
    image: string | null
} & ArticleColumns

/**
 * Colonnes ajoutées par la migration `20260825120000_annonce_article`.
 *
 * Déclarées à la main parce que `src/integrations/supabase/types.ts` est
 * généré et ne peut l'être qu'avec un accès à la base. Ce bloc est à
 * supprimer au prochain `supabase gen types` — les colonnes seront alors
 * portées par `Tables<"annonce">`.
 */
interface ArticleColumns {
    /** `profiles.user_id` de l'auteur. NULL sur les annonces antérieures. */
    author_id: string | null
    /** Chapô : l'accroche du bandeau et de la tête d'article. */
    excerpt: string | null
    /** Corps en markdown restreint ; à défaut, `description` fait foi. */
    body_markdown: string | null
    /** Date affichée, distincte de la fenêtre de publication. */
    event_date: string | null
    /** Signature, jointe depuis `profiles`. Absente si `author_id` est nul. */
    author: AnnouncementAuthor | null
}

/** Ce qu'on montre d'un auteur : un nom et un visage. */
export interface AnnouncementAuthor {
    user_id: string
    full_name: string | null
    avatar_url: string | null
}

/** Champs saisissables dans le formulaire. */
export interface AnnouncementDraft {
    titre: string
    type: AnnouncementType
    /** Chapô, ~280 caractères. */
    excerpt: string | null
    /** Corps de l'article, en markdown restreint. */
    body_markdown: string | null
    /** Date affichée au lecteur (`YYYY-MM-DD`). */
    event_date: string | null
    /** Auteur signataire. */
    author_id: string | null
    /**
     * @deprecated Corps en texte brut, conservé pour les annonces
     * antérieures à `body_markdown`. Le lecteur y retombe quand le corps
     * markdown est vide ; le formulaire ne l'écrit plus.
     */
    description: string | null
    /** Chemin dans le bucket, ou data-URL héritée. */
    image: string | null
    link: string | null
    start_date: string
    end_date: string | null
    pinned: boolean
    /** Tableau vide = tous les rôles. */
    target_role_ids: string[]
    /** Tableau vide = tous les services. */
    target_service_ids: string[]
}

/**
 * Statut dérivé d'une annonce — calculé, jamais stocké.
 *
 * - `archived` prime sur tout : l'annonce est masquée quoi qu'il arrive.
 * - `planned`  : la fenêtre n'a pas commencé.
 * - `online`   : la fenêtre est ouverte.
 * - `expired`  : la fenêtre est passée.
 */
export type AnnouncementStatus = "archived" | "planned" | "online" | "expired"
