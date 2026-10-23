import { useMemo } from "react"
import {
    ChevronLeft,
    ChevronRight,
    FileText,
    Folder,
    Loader2,
    SearchX,
} from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { WIKI_STATUS_LABEL } from "../../constants"
import { WIKI_THEME } from "../../theme"
import { useWikiContext } from "../../hooks/context/useWikiContext"
import { getCategoryPath } from "../../utils/wikiTree"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { WikiArticle } from "../../types/wiki-article.types"

/** Aperçu texte d'un article (1re section de texte, sinon body legacy). */
function excerpt(article: WikiArticle, max = 120) {
    const firstText = article.sections.find((s) => s.type === "text")
    const source =
        (firstText && firstText.type === "text" && firstText.content) ||
        article.body ||
        ""
    const text = source
        .replace(/[#>*_`~-]/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
    return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * Panneau principal de consultation : recherche globale (pilotée par la toolbar)
 * ou sous-catégories + articles de la catégorie courante.
 */
export function ArticleList() {
    const {
        categories,
        childCategories,
        currentArticles,
        selectedCategoryId,
        setSelectedCategoryId,
        setSelectedArticle,
        branchArticleCount,
        breadcrumb,
        loading,
        searchQuery,
        searchResults,
        canManage,
    } = useWikiContext()

    const searching = searchQuery.trim().length > 0

    // Remontée d'un niveau : le parent est l'avant-dernier maillon du fil
    // d'Ariane (racine → catégorie courante) ; à un niveau racine, on remonte
    // vers « Tous les articles » (selectedCategoryId = null).
    const parentCategory =
        breadcrumb.length >= 2 ? breadcrumb[breadcrumb.length - 2] : null
    const parentLabel = parentCategory?.name ?? "Tous les articles"
    const goToParent = () => {
        setSelectedCategoryId(parentCategory?.id ?? null)
        setSelectedArticle(null)
    }

    const categoryName = (id: string | null) =>
        id ? categories.find((c) => c.id === id)?.name : undefined

    const pathLabel = useMemo(
        () => (article: WikiArticle) =>
            getCategoryPath(categories, article.category_id)
                .map((c) => c.name)
                .join(" › "),
        [categories]
    )

    return (
        <div className="mx-auto max-w-5xl space-y-7 px-5 py-6 md:px-8 md:py-8">
                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* Mode recherche */}
                {!loading && searching && (
                    <section className="space-y-3 animate-in fade-in duration-base">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {searchResults.length} résultat
                            {searchResults.length > 1 ? "s" : ""}
                        </p>
                        {searchResults.length === 0 ? (
                            <EmptyState
                                variant="search"
                                icon={SearchX}
                                title="Aucun résultat"
                                description="Aucun article ne correspond à votre recherche."
                                className="rounded-2xl border border-dashed"
                            />
                        ) : (
                            <div className="space-y-2">
                                {searchResults.map((article) => (
                                    <button
                                        key={article.id}
                                        type="button"
                                        onClick={() =>
                                            setSelectedArticle(article, "search")
                                        }
                                        className="group flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-sm"
                                    >
                                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-2">
                                                <span className="truncate font-medium">
                                                    {article.title}
                                                </span>
                                                {canManage &&
                                                    article.status ===
                                                        "draft" && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "shrink-0 px-1.5 py-0 text-[10px]",
                                                                WIKI_THEME.badge
                                                                    .draft
                                                            )}
                                                        >
                                                            {
                                                                WIKI_STATUS_LABEL.draft
                                                            }
                                                        </Badge>
                                                    )}
                                            </span>
                                            {pathLabel(article) && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {pathLabel(article)}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Mode navigation */}
                {!loading && !searching && (
                    <div className="space-y-7 animate-in fade-in duration-base">
                        {/* En-tête de localisation (masqué à la racine) :
                            sur-ligne de remontée vers le parent + nom de la
                            catégorie courante. Le filet sépare nettement la
                            navigation des libellés de section ; c'est aussi la
                            seule voie de remontée sur mobile (fil d'Ariane du
                            topbar caché). */}
                        {selectedCategoryId && (
                            <div className="space-y-1 border-b pb-4">
                                <button
                                    type="button"
                                    onClick={goToParent}
                                    aria-label={`Remonter vers ${parentLabel}`}
                                    className="group -ml-0.5 inline-flex max-w-full items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                                    <span className="truncate">
                                        {parentLabel}
                                    </span>
                                </button>
                                <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                                    {categoryName(selectedCategoryId)}
                                </h1>
                            </div>
                        )}

                        {childCategories.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {selectedCategoryId
                                        ? "Sous-catégories"
                                        : "Catégories"}
                                </h2>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {childCategories.map((category) => (
                                        <button
                                            key={category.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCategoryId(
                                                    category.id
                                                )
                                                setSelectedArticle(null)
                                            }}
                                            className={WIKI_THEME.card.category}
                                        >
                                            <span
                                                className={
                                                    WIKI_THEME.card.iconWrap
                                                }
                                            >
                                                <Folder className="h-5 w-5" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-medium">
                                                    {category.name}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {branchArticleCount(
                                                        category.id
                                                    )}{" "}
                                                    article
                                                    {branchArticleCount(
                                                        category.id
                                                    ) > 1
                                                        ? "s"
                                                        : ""}
                                                </span>
                                            </span>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {currentArticles.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Articles
                                </h2>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {currentArticles.map((article) => {
                                        const preview = excerpt(article)
                                        return (
                                        <button
                                            key={article.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedArticle(article, "list")
                                            }
                                            className={WIKI_THEME.card.article}
                                        >
                                            <span className="flex items-center gap-2 font-medium">
                                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="truncate">
                                                    {article.title}
                                                </span>
                                                {canManage &&
                                                    article.status ===
                                                        "draft" && (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "ml-auto shrink-0 px-1.5 py-0 text-[10px]",
                                                                WIKI_THEME.badge
                                                                    .draft
                                                            )}
                                                        >
                                                            {
                                                                WIKI_STATUS_LABEL.draft
                                                            }
                                                        </Badge>
                                                    )}
                                            </span>
                                            {preview && (
                                                <span className="line-clamp-2 text-sm text-muted-foreground">
                                                    {preview}
                                                </span>
                                            )}
                                        </button>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {childCategories.length === 0 &&
                            currentArticles.length === 0 && (
                                <EmptyState
                                    icon={FileText}
                                    title={
                                        selectedCategoryId
                                            ? "Catégorie vide"
                                            : "Wiki vide"
                                    }
                                    description={
                                        selectedCategoryId
                                            ? "Cette catégorie ne contient encore aucun article."
                                            : "Le wiki est vide pour le moment."
                                    }
                                    className="rounded-2xl border border-dashed"
                                />
                            )}
                    </div>
                )}
        </div>
    )
}
