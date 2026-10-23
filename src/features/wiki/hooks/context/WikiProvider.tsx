import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWikiCategories } from "../data/useWikiCategories"
import { useWikiArticles } from "../data/useWikiArticles"
import { useWikiManagement } from "../data/useWikiManagement"
import { WIKI_PERMISSION } from "../../constants"
import {
    buildBranchArticleCounts,
    buildCategoryTree,
    collectBranchIds,
    getCategoryPath,
    getChildCategories,
} from "../../utils/wikiTree"
import {
    WikiContext,
    type WikiContextValue,
    type WikiMode,
} from "./WikiContext"
import type { WikiArticle } from "../../types/wiki-article.types"
import type { WikiViewSource } from "../../types/wiki-analytics.types"

/**
 * Provider de l'état partagé de la consultation du wiki : arborescence,
 * catégorie/article sélectionnés, dépliage de l'arbre, recherche.
 * Câblage uniquement — la logique vit dans les hooks data + utils
 * (guide Architecture §6 / §8.3).
 */
export default function WikiProvider({ children }: { children: ReactNode }) {
    const { hasPermission } = useAuth()
    const canManage = hasPermission(WIKI_PERMISSION.manage)

    const {
        categories,
        loading: categoriesLoading,
        error: categoriesError,
        fetchCategories,
        createCategory,
        updateCategory,
        reorderCategories,
        deleteCategory,
    } = useWikiCategories()
    // Les managers chargent aussi les brouillons (la RLS `wiki.view` les masque
    // de toute façon aux non-managers).
    const {
        articles,
        loading: articlesLoading,
        error: articlesError,
        fetchArticles,
        createArticle,
        updateArticle,
        deleteArticle,
    } = useWikiArticles(!canManage)

    // Portée d'une suppression de catégorie, pour la confirmation : la branche
    // entière disparaît (CASCADE) et ses articles sont détachés (SET NULL).
    const getCategoryImpact = useCallback(
        (id: string) => {
            const branch = collectBranchIds(categories, id)
            return {
                subcategories: branch.size - 1,
                articles: articles.filter(
                    (a) => a.category_id && branch.has(a.category_id)
                ).length,
            }
        },
        [categories, articles]
    )

    const management = useWikiManagement({
        createArticle,
        updateArticle,
        deleteArticle,
        deleteCategory,
        refreshArticles: fetchArticles,
        getCategoryImpact,
    })

    const [mode, setMode] = useState<WikiMode>("read")

    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
        null
    )
    const [selectedArticle, setSelectedArticle] =
        useState<WikiArticle | null>(null)
    // Point d'entrée de la dernière ouverture : tracé tel quel dans
    // `wiki_article_views.source` par useWikiViewTracker. Porté par le
    // provider pour éviter de faire remonter la valeur par chaque appelant.
    const [selectionSource, setSelectionSource] =
        useState<WikiViewSource>("direct")

    const selectArticle = useCallback(
        (article: WikiArticle | null, source: WikiViewSource = "direct") => {
            setSelectionSource(source)
            setSelectedArticle(article)
        },
        []
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => new Set()
    )

    const tree = useMemo(
        () => buildCategoryTree(categories),
        [categories]
    )

    const toggleExpanded = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const childCategories = useMemo(
        () => getChildCategories(categories, selectedCategoryId),
        [categories, selectedCategoryId]
    )

    const currentArticles = useMemo(
        () =>
            articles.filter((a) => a.category_id === selectedCategoryId),
        [articles, selectedCategoryId]
    )

    const breadcrumb = useMemo(
        () => getCategoryPath(categories, selectedCategoryId),
        [categories, selectedCategoryId]
    )

    // Tout le chemin racine → catégorie courante reste déplié dans l'arbre.
    const forcedOpenIds = useMemo(
        () => new Set(breadcrumb.map((c) => c.id)),
        [breadcrumb]
    )

    const branchArticleCounts = useMemo(
        () =>
            buildBranchArticleCounts(
                categories,
                articles.map((a) => a.category_id)
            ),
        [categories, articles]
    )

    const branchArticleCount = useCallback(
        (categoryId: string) => branchArticleCounts.get(categoryId) ?? 0,
        [branchArticleCounts]
    )

    const searchResults = useMemo(() => {
        const query = searchQuery.toLowerCase().trim()
        if (!query) return []
        return articles.filter(
            (a) =>
                a.title.toLowerCase().includes(query) ||
                a.body.toLowerCase().includes(query)
        )
    }, [articles, searchQuery])

    const value = useMemo<WikiContextValue>(
        () => ({
            categories,
            tree,
            articles,
            searchResults,
            loading: categoriesLoading || articlesLoading,
            error: categoriesError ?? articlesError,
            refetch: async () => {
                await Promise.all([fetchCategories(), fetchArticles()])
            },
            selectedCategoryId,
            setSelectedCategoryId,
            selectedArticle,
            setSelectedArticle: selectArticle,
            selectionSource,
            expandedIds,
            toggleExpanded,
            forcedOpenIds,
            searchQuery,
            setSearchQuery,
            childCategories,
            currentArticles,
            breadcrumb,
            branchArticleCount,
            canManage,
            mode,
            setMode,
            createCategory,
            updateCategory,
            reorderCategories,
            ...management,
        }),
        [
            categories,
            tree,
            articles,
            searchResults,
            categoriesLoading,
            articlesLoading,
            categoriesError,
            articlesError,
            fetchCategories,
            fetchArticles,
            selectedCategoryId,
            selectedArticle,
            selectArticle,
            selectionSource,
            expandedIds,
            toggleExpanded,
            forcedOpenIds,
            searchQuery,
            childCategories,
            currentArticles,
            breadcrumb,
            branchArticleCount,
            canManage,
            mode,
            createCategory,
            updateCategory,
            reorderCategories,
            management,
        ]
    )

    return <WikiContext value={value}>{children}</WikiContext>
}
