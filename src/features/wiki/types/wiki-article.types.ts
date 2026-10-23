// Contrats TypeScript du domaine « article de wiki ».
// Une page est construite par sections ordonnées (blocs texte / image).

import type { WIKI_ARTICLE_STATUS } from "../constants"

export type WikiArticleStatus = (typeof WIKI_ARTICLE_STATUS)[number]

/** Bloc de texte : titre optionnel + contenu markdown. */
export interface WikiTextSection {
    id: string
    type: "text"
    title?: string
    content: string
}

/** Bloc image (capture d'écran) : URL publique + légende. */
export interface WikiImageSection {
    id: string
    type: "image"
    url: string
    caption?: string
    alt?: string
}

export type WikiSection = WikiTextSection | WikiImageSection

export interface WikiArticle {
    id: string
    category_id: string | null
    title: string
    slug: string | null
    /** Markdown legacy (fallback si `sections` est vide). */
    body: string
    sections: WikiSection[]
    status: WikiArticleStatus
    position: number
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface WikiArticleFormInput {
    title: string
    category_id: string | null
    sections: WikiSection[]
    status: WikiArticleStatus
    position?: number
}
