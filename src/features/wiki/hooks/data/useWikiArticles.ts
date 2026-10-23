import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { wikiService } from "../../services/wikiService"
import type {
    WikiArticle,
    WikiArticleFormInput,
} from "../../types/wiki-article.types"

// Ordre du serveur (position puis titre) — appliqué aux maj locales pour rester
// cohérent avec wikiService.listArticles.
const sortArticles = (list: WikiArticle[]) =>
    [...list].sort(
        (a, b) => a.position - b.position || a.title.localeCompare(b.title)
    )

/**
 * Orchestre wikiService pour les articles de wiki (CRUD + état local).
 *
 * @param onlyPublished true pour la consultation, false pour l'admin.
 */
export function useWikiArticles(onlyPublished: boolean) {
    const { user } = useAuth()
    const [articles, setArticles] = useState<WikiArticle[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchArticles = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            setArticles(await wikiService.listArticles(onlyPublished))
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setLoading(false)
        }
    }, [onlyPublished])

    // Mises à jour locales (pas de refetch complet après chaque mutation).
    const createArticle = useCallback(
        async (input: WikiArticleFormInput) => {
            const created = await wikiService.createArticle(
                input,
                user?.user_id ?? null
            )
            setArticles((prev) => sortArticles([...prev, created]))
            return created
        },
        [user?.user_id]
    )

    const updateArticle = useCallback(
        async (id: string, input: Partial<WikiArticleFormInput>) => {
            const updated = await wikiService.updateArticle(id, input)
            setArticles((prev) =>
                sortArticles(prev.map((a) => (a.id === id ? updated : a)))
            )
        },
        []
    )

    const deleteArticle = useCallback(async (id: string) => {
        await wikiService.deleteArticle(id)
        setArticles((prev) => prev.filter((a) => a.id !== id))
    }, [])

    useEffect(() => {
        fetchArticles()
    }, [fetchArticles])

    return {
        articles,
        loading,
        error,
        fetchArticles,
        createArticle,
        updateArticle,
        deleteArticle,
    }
}
