import { createContext } from "react"
import type {
    WikiArticle,
    WikiArticleFormInput,
} from "../../types/wiki-article.types"
import type {
    WikiCategory,
    WikiCategoryFormInput,
    WikiCategoryMove,
    WikiCategoryNode,
} from "../../types/wiki-category.types"
import type { WikiViewSource } from "../../types/wiki-analytics.types"

/** Mode d'affichage de la page wiki unifiée. */
export type WikiMode = "read" | "manage"

export interface WikiContextValue {
    // data
    categories: WikiCategory[]
    /** Arborescence construite à partir de `categories`. */
    tree: WikiCategoryNode[]
    articles: WikiArticle[]
    /** Articles correspondant à la recherche (toutes catégories). */
    searchResults: WikiArticle[]
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>

    // navigation
    selectedCategoryId: string | null
    setSelectedCategoryId: (id: string | null) => void
    selectedArticle: WikiArticle | null
    /**
     * @param source point d'entrée de l'ouverture, tracé dans
     *   `wiki_article_views.source` (défaut : `direct`).
     */
    setSelectedArticle: (
        article: WikiArticle | null,
        source?: WikiViewSource
    ) => void
    /** Point d'entrée de la consultation en cours (télémétrie). */
    selectionSource: WikiViewSource
    /** Catégories dépliées dans l'arbre (par id). */
    expandedIds: Set<string>
    toggleExpanded: (id: string) => void
    /** Ancêtres de la catégorie courante : toujours dépliés (branche active révélée). */
    forcedOpenIds: Set<string>

    // recherche
    searchQuery: string
    setSearchQuery: (query: string) => void

    // sélecteurs dérivés
    /** Sous-catégories directes de la catégorie courante. */
    childCategories: WikiCategory[]
    /** Articles directement rattachés à la catégorie courante. */
    currentArticles: WikiArticle[]
    /** Fil d'Ariane racine → catégorie courante. */
    breadcrumb: WikiCategory[]
    /** Nombre d'articles dans la branche (catégorie + descendants). */
    branchArticleCount: (categoryId: string) => number

    // gestion (manager uniquement)
    /** L'utilisateur courant possède la permission `wiki.manage`. */
    canManage: boolean
    /** Mode actif : consultation (`read`) ou gestion (`manage`). */
    mode: WikiMode
    setMode: (mode: WikiMode) => void

    // état de l'éditeur d'article (inline ou panneau de gestion)
    editorOpen: boolean
    editingArticle: WikiArticle | null
    openCreateArticle: () => void
    openEditArticle: (article: WikiArticle) => void
    closeEditor: () => void

    // états d'action en cours
    savingArticle: boolean
    deletingArticleId: string | null
    togglingId: string | null
    deletingCategoryId: string | null

    // handlers (avec toast/confirmation), réutilisés en inline et en gestion
    saveArticle: (input: WikiArticleFormInput) => Promise<void>
    removeArticle: (article: WikiArticle) => Promise<void>
    togglePublish: (article: WikiArticle) => Promise<void>
    createCategory: (input: WikiCategoryFormInput) => Promise<unknown>
    updateCategory: (
        id: string,
        input: Partial<WikiCategoryFormInput>
    ) => Promise<void>
    /** Déplace/réordonne des catégories (drag & drop de l'arborescence). */
    reorderCategories: (moves: WikiCategoryMove[]) => Promise<void>
    removeCategory: (category: WikiCategory) => Promise<void>
}

export const WikiContext = createContext<WikiContextValue | null>(null)
