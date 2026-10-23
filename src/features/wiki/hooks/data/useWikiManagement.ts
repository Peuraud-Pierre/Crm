import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import type {
    WikiArticle,
    WikiArticleFormInput,
} from "../../types/wiki-article.types"
import type { WikiCategory } from "../../types/wiki-category.types"

/** API CRUD attendue (issue de useWikiArticles / useWikiCategories). */
interface WikiManagementDeps {
    createArticle: (input: WikiArticleFormInput) => Promise<WikiArticle>
    updateArticle: (
        id: string,
        input: Partial<WikiArticleFormInput>
    ) => Promise<void>
    deleteArticle: (id: string) => Promise<void>
    deleteCategory: (id: string) => Promise<void>
    /** Recharge les articles (leur FK catégorie peut bouger à la suppression). */
    refreshArticles: () => Promise<void>
    /**
     * Portée d'une suppression de catégorie : la FK est `ON DELETE CASCADE`
     * sur les sous-catégories et `ON DELETE SET NULL` sur les articles. Depuis
     * que l'arborescence est réorganisable, une branche peut être profonde —
     * on annonce donc l'impact avant de confirmer.
     */
    getCategoryImpact: (id: string) => { subcategories: number; articles: number }
}

/**
 * État de l'éditeur d'article + handlers de gestion (toast/confirmation).
 * Logique commune à l'édition inline (consultation) et au panneau de gestion ;
 * orchestre uniquement les CRUD fournis par les hooks data.
 */
export function useWikiManagement({
    createArticle,
    updateArticle,
    deleteArticle,
    deleteCategory,
    refreshArticles,
    getCategoryImpact,
}: WikiManagementDeps) {
    const [editorOpen, setEditorOpen] = useState(false)
    const [editingArticle, setEditingArticle] = useState<WikiArticle | null>(
        null
    )
    const [savingArticle, setSavingArticle] = useState(false)
    const [deletingArticleId, setDeletingArticleId] = useState<string | null>(
        null
    )
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(
        null
    )

    const openCreateArticle = useCallback(() => {
        setEditingArticle(null)
        setEditorOpen(true)
    }, [])

    const openEditArticle = useCallback((article: WikiArticle) => {
        setEditingArticle(article)
        setEditorOpen(true)
    }, [])

    const closeEditor = useCallback(() => {
        setEditorOpen(false)
        setEditingArticle(null)
    }, [])

    const saveArticle = useCallback(
        async (input: WikiArticleFormInput) => {
            try {
                setSavingArticle(true)
                if (editingArticle) {
                    await updateArticle(editingArticle.id, input)
                    toast.success("Article mis à jour")
                } else {
                    await createArticle(input)
                    toast.success("Article créé")
                }
                setEditorOpen(false)
                setEditingArticle(null)
            } catch (err) {
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Erreur d'enregistrement"
                )
            } finally {
                setSavingArticle(false)
            }
        },
        [editingArticle, createArticle, updateArticle]
    )

    const removeArticle = useCallback(
        async (article: WikiArticle) => {
            if (!confirm(`Supprimer l'article « ${article.title} » ?`)) return
            try {
                setDeletingArticleId(article.id)
                await deleteArticle(article.id)
                toast.success("Article supprimé")
            } catch (err) {
                toast.error(
                    err instanceof Error ? err.message : "Erreur de suppression"
                )
            } finally {
                setDeletingArticleId(null)
            }
        },
        [deleteArticle]
    )

    const togglePublish = useCallback(
        async (article: WikiArticle) => {
            try {
                setTogglingId(article.id)
                await updateArticle(article.id, {
                    status:
                        article.status === "published" ? "draft" : "published",
                })
            } catch (err) {
                toast.error(
                    err instanceof Error ? err.message : "Erreur de publication"
                )
            } finally {
                setTogglingId(null)
            }
        },
        [updateArticle]
    )

    const removeCategory = useCallback(
        async (category: WikiCategory) => {
            const { subcategories, articles } = getCategoryImpact(category.id)
            const details = [
                subcategories > 0 &&
                    `${subcategories} sous-catégorie${subcategories > 1 ? "s" : ""} ${subcategories > 1 ? "seront supprimées" : "sera supprimée"} avec elle`,
                articles > 0 &&
                    `${articles} article${articles > 1 ? "s" : ""} ${articles > 1 ? "seront détachés" : "sera détaché"} (aucun n'est supprimé)`,
            ].filter(Boolean)

            const impact = details.length
                ? `\n\n${details.map((d) => `• ${d}`).join("\n")}`
                : " Les articles ne seront pas supprimés."

            if (
                !confirm(
                    `Supprimer la catégorie « ${category.name} » ?${impact}`
                )
            )
                return
            try {
                setDeletingCategoryId(category.id)
                await deleteCategory(category.id)
                // Les articles rattachés ont pu voir leur catégorie passer à
                // null (FK) : on resynchronise leur état local.
                await refreshArticles()
                toast.success("Catégorie supprimée")
            } catch (err) {
                toast.error(
                    err instanceof Error ? err.message : "Erreur de suppression"
                )
            } finally {
                setDeletingCategoryId(null)
            }
        },
        [deleteCategory, refreshArticles, getCategoryImpact]
    )

    return useMemo(
        () => ({
            editorOpen,
            editingArticle,
            openCreateArticle,
            openEditArticle,
            closeEditor,
            savingArticle,
            deletingArticleId,
            togglingId,
            deletingCategoryId,
            saveArticle,
            removeArticle,
            togglePublish,
            removeCategory,
        }),
        [
            editorOpen,
            editingArticle,
            openCreateArticle,
            openEditArticle,
            closeEditor,
            savingArticle,
            deletingArticleId,
            togglingId,
            deletingCategoryId,
            saveArticle,
            removeArticle,
            togglePublish,
            removeCategory,
        ]
    )
}
