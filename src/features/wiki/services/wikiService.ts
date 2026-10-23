import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import { safeRandomUUID } from "@/shared/lib/uuid"
import type {
    WikiArticle,
    WikiArticleFormInput,
    WikiSection,
} from "../types/wiki-article.types"
import type {
    WikiCategory,
    WikiCategoryFormInput,
    WikiCategoryMove,
} from "../types/wiki-category.types"

/**
 * Couche d'accès aux données de la feature wiki (guide Architecture §5.2 :
 * tout appel Supabase vit ici, les hooks ne font qu'orchestrer).
 *
 * Les tables `wiki_categories` / `wiki_articles` ne sont pas encore dans
 * `integrations/supabase/types.ts` (auto-généré). On caste le client comme
 * `features/stock/services/arrivageService.ts` ; le typage applicatif est
 * assuré par les interfaces WikiArticle / WikiCategory.
 *
 * **À régénérer après migration** via l'UI admin GenTypes pour retrouver le
 * typage strict.
 */
const db = supabase as unknown as SupabaseClient

/** Bucket public Supabase Storage des images d'articles. */
const WIKI_BUCKET = "wiki"

export const wikiService = {
    // -------- Catégories --------
    listCategories: () =>
        db
            .from("wiki_categories")
            .select("*")
            .order("position", { ascending: true })
            .order("name", { ascending: true })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []) as WikiCategory[]
            }),

    createCategory: (input: WikiCategoryFormInput) =>
        db
            .from("wiki_categories")
            .insert([
                {
                    name: input.name,
                    parent_id: input.parent_id ?? null,
                    position: input.position ?? 0,
                },
            ])
            .select("*")
            .single()
            .then(({ data, error }) => {
                if (error) throw error
                return data as WikiCategory
            }),

    updateCategory: (id: string, input: Partial<WikiCategoryFormInput>) =>
        db
            .from("wiki_categories")
            .update(input)
            .eq("id", id)
            .then(({ error }) => {
                if (error) throw error
            }),

    /**
     * Déplace/réordonne des catégories en une seule transaction serveur.
     * Un déplacement renumérote toute une fratrie : N `update` séparés
     * laisseraient l'arbre incohérent en cas d'échec au milieu. La RPC porte
     * aussi la garde anti-cycle (voir 20260901100000_wiki_category_reorder.sql).
     */
    reorderCategories: (moves: WikiCategoryMove[]) =>
        db
            .rpc("wiki_reorder_categories", { p_updates: moves })
            .then(({ error }) => {
                if (error) throw error
            }),

    deleteCategory: (id: string) =>
        db
            .from("wiki_categories")
            .delete()
            .eq("id", id)
            .then(({ error }) => {
                if (error) throw error
            }),

    // -------- Articles --------
    /**
     * @param onlyPublished true pour la consultation (les non-managers ne voient
     *   de toute façon que les articles publiés via RLS, mais on filtre aussi
     *   côté requête pour l'admin qui veut la liste complète).
     */
    listArticles: (onlyPublished: boolean) => {
        let query = db
            .from("wiki_articles")
            .select("*")
            .order("position", { ascending: true })
            .order("title", { ascending: true })
        if (onlyPublished) query = query.eq("status", "published")
        return query.then(({ data, error }) => {
            if (error) throw error
            return (data ?? []).map(normalizeArticle)
        })
    },

    createArticle: (input: WikiArticleFormInput, createdBy: string | null) =>
        db
            .from("wiki_articles")
            .insert([
                {
                    title: input.title,
                    category_id: input.category_id,
                    sections: input.sections,
                    status: input.status,
                    position: input.position ?? 0,
                    created_by: createdBy,
                },
            ])
            .select("*")
            .single()
            .then(({ data, error }) => {
                if (error) throw error
                return normalizeArticle(data)
            }),

    updateArticle: (id: string, input: Partial<WikiArticleFormInput>) =>
        db
            .from("wiki_articles")
            .update(input)
            .eq("id", id)
            .select("*")
            .single()
            .then(({ data, error }) => {
                if (error) throw error
                return normalizeArticle(data)
            }),

    deleteArticle: (id: string) =>
        db
            .from("wiki_articles")
            .delete()
            .eq("id", id)
            .then(({ error }) => {
                if (error) throw error
            }),

    // -------- Images (Supabase Storage, bucket public 'wiki') --------
    /** Téléverse une image et renvoie son URL publique. */
    uploadImage: async (file: File): Promise<string> => {
        const ext = file.name.split(".").pop()?.toLowerCase() || "png"
        const path = `articles/${safeRandomUUID()}.${ext}`
        const { error } = await supabase.storage
            .from(WIKI_BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                contentType: file.type || undefined,
                upsert: false,
            })
        if (error) throw error
        const { data } = supabase.storage.from(WIKI_BUCKET).getPublicUrl(path)
        return data.publicUrl
    },
}

/** Coerce les champs issus de Supabase (sections jsonb peut être null). */
function normalizeArticle(row: unknown): WikiArticle {
    const r = row as WikiArticle & { sections: WikiSection[] | null }
    return {
        ...r,
        body: r.body ?? "",
        sections: Array.isArray(r.sections) ? r.sections : [],
    }
}
