import { useMemo, useRef, useState } from "react"
import {
    BarChart3,
    BookText,
    FileText,
    FolderTree,
    Loader2,
    Pencil,
    Plus,
    Search,
    SearchX,
    Sparkles,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { cn } from "@/shared/lib/utils"
import { useWikiContext } from "../hooks/context/useWikiContext"
import {
    buildCategoryTree,
    flattenTreeWithDepth,
    getCategoryPath,
} from "../utils/wikiTree"
import { ArticleAdminCard } from "./article/ArticleAdminCard"
import { CategoryManager } from "./category/CategoryManager"
import { WikiStatsPanel } from "./stats/WikiStatsPanel"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { WikiArticleStatus } from "../types/wiki-article.types"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"

type StatusFilter = "all" | WikiArticleStatus

/**
 * Mode « Gestion » du wiki : tableau de bord d'articles (statistiques, filtres,
 * cartes) et gestion arborescente des catégories. Câblé sur le contexte —
 * monté uniquement quand `canManage` est vrai.
 */
export function WikiManagePanel() {
    const {
        articles,
        categories,
        loading,
        deletingArticleId,
        togglingId,
        deletingCategoryId,
        openCreateArticle,
        openEditArticle,
        removeArticle,
        togglePublish,
        createCategory,
        updateCategory,
        reorderCategories,
        removeCategory,
    } = useWikiContext()

    const [query, setQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [categoryFilter, setCategoryFilter] = useState<string>("all")

    const stats = useMemo(() => {
        const published = articles.filter(
            (a) => a.status === "published"
        ).length
        return {
            total: articles.length,
            published,
            drafts: articles.length - published,
            categories: categories.length,
        }
    }, [articles, categories])

    const flatCategories = useMemo(
        () => flattenTreeWithDepth(buildCategoryTree(categories)),
        [categories]
    )

    const pathLabel = useMemo(
        () => (categoryId: string | null) => {
            const path = getCategoryPath(categories, categoryId)
            return path.length ? path.map((c) => c.name).join(" › ") : "Sans catégorie"
        },
        [categories]
    )

    const visibleArticles = useMemo(() => {
        const q = query.trim().toLowerCase()
        return articles
            .filter((a) => statusFilter === "all" || a.status === statusFilter)
            .filter((a) => {
                if (categoryFilter === "all") return true
                if (categoryFilter === "none") return a.category_id === null
                return a.category_id === categoryFilter
            })
            .filter((a) => !q || a.title.toLowerCase().includes(q))
            .sort(
                (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime()
            )
    }, [articles, statusFilter, categoryFilter, query])

    // Conteneur du filtre de statut : offsetParent de la pastille glissante.
    const statusRef = useRef<HTMLDivElement | null>(null)

    const statusSegments: { value: StatusFilter; label: string; count: number }[] =
        [
            { value: "all", label: "Tous", count: stats.total },
            { value: "published", label: "Publiés", count: stats.published },
            { value: "draft", label: "Brouillons", count: stats.drafts },
        ]

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
            {/* En-tête + statistiques */}
            <header className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                            Gestion du wiki
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Créez, organisez et publiez les articles de la base
                            de connaissances.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard
                        icon={<FileText className="h-4 w-4" />}
                        value={stats.total}
                        label="Articles"
                    />
                    <StatCard
                        icon={<Sparkles className="h-4 w-4" />}
                        value={stats.published}
                        label="Publiés"
                        accent="text-emerald-600"
                    />
                    <StatCard
                        icon={<Pencil className="h-4 w-4" />}
                        value={stats.drafts}
                        label="Brouillons"
                        accent="text-amber-600"
                    />
                    <StatCard
                        icon={<FolderTree className="h-4 w-4" />}
                        value={stats.categories}
                        label="Catégories"
                    />
                </div>
            </header>

            <Tabs defaultValue="articles" className="space-y-5">
                <TabsList indicator indicatorClassName="rounded-sm" className="grid w-full max-w-lg grid-cols-3">
                    <TabsTrigger value="articles" className="gap-1.5">
                        <BookText className="h-4 w-4" />
                        Articles
                    </TabsTrigger>
                    <TabsTrigger value="categories" className="gap-1.5">
                        <FolderTree className="h-4 w-4" />
                        Catégories
                    </TabsTrigger>
                    <TabsTrigger value="stats" className="gap-1.5">
                        <BarChart3 className="h-4 w-4" />
                        Statistiques
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="articles" className="mt-0 space-y-5">
                    {/* Barre de filtres */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative lg:w-64">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Rechercher un article…"
                                aria-label="Rechercher un article"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="h-9 rounded-full pl-9"
                            />
                        </div>

                        <TabButtonGroup
                            containerRef={statusRef}
                            aria-label="Filtrer par statut"
                            className="inline-flex items-center gap-0.5 rounded-full border bg-muted/60 p-0.5"
                        >
                            {statusSegments.map((seg) => {
                                const active = statusFilter === seg.value
                                return (
                                    <TabButton
                                        key={seg.value}
                                        id={seg.value}
                                        label={seg.label}
                                        shortLabel={seg.label}
                                        active={statusFilter}
                                        set={(v) =>
                                            setStatusFilter(
                                                v as typeof statusFilter
                                            )
                                        }
                                        badge={
                                            <span
                                                className={cn(
                                                    "rounded-full px-1.5 text-2xs tabular-nums",
                                                    active
                                                        ? "bg-primary/15 text-primary"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {seg.count}
                                            </span>
                                        }
                                    />
                                )
                            })}
                        </TabButtonGroup>

                        <Select
                            value={categoryFilter}
                            onValueChange={setCategoryFilter}
                        >
                            <SelectTrigger
                                aria-label="Filtrer par catégorie"
                                className="h-9 lg:w-56"
                            >
                                <SelectValue placeholder="Catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Toutes les catégories
                                </SelectItem>
                                <SelectItem value="none">
                                    Sans catégorie
                                </SelectItem>
                                {flatCategories.map(({ category, depth }) => (
                                    <SelectItem
                                        key={category.id}
                                        value={category.id}
                                    >
                                        <span style={{ paddingLeft: depth * 12 }}>
                                            {depth > 0 ? "› " : ""}
                                            {category.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            onClick={openCreateArticle}
                            className="h-9 gap-2 rounded-full lg:ml-auto"
                        >
                            <Plus className="h-4 w-4" />
                            Nouvel article
                        </Button>
                    </div>

                    {/* Grille de cartes */}
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : stats.total === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title="Aucun article"
                            description="Commencez par créer votre premier article."
                            action={{
                                label: "Nouvel article",
                                onClick: openCreateArticle,
                                icon: Plus,
                            }}
                            className="rounded-2xl border border-dashed"
                        />
                    ) : visibleArticles.length === 0 ? (
                        <EmptyState
                            variant="search"
                            icon={SearchX}
                            title="Aucun résultat"
                            description="Aucun article ne correspond à ces filtres."
                            className="rounded-2xl border border-dashed"
                        />
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {visibleArticles.map((article) => (
                                <ArticleAdminCard
                                    key={article.id}
                                    article={article}
                                    categoryPath={pathLabel(
                                        article.category_id
                                    )}
                                    deleting={deletingArticleId === article.id}
                                    toggling={togglingId === article.id}
                                    onEdit={() => openEditArticle(article)}
                                    onDelete={() => removeArticle(article)}
                                    onTogglePublish={() =>
                                        togglePublish(article)
                                    }
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="categories" className="mt-0">
                    <CategoryManager
                        categories={categories}
                        loading={loading}
                        onCreate={createCategory}
                        onUpdate={updateCategory}
                        onReorder={reorderCategories}
                        onDelete={removeCategory}
                        deletingId={deletingCategoryId}
                    />
                </TabsContent>

                {/* Monté à l'activation de l'onglet : les RPC de stats ne
                    partent pas à l'ouverture du mode gestion. */}
                <TabsContent value="stats" className="mt-0">
                    <WikiStatsPanel />
                </TabsContent>
            </Tabs>
        </div>
    )
}

/** Carte statistique compacte de l'en-tête. */
function StatCard({
    icon,
    value,
    label,
    accent,
}: {
    icon: React.ReactNode
    value: number
    label: string
    accent?: string
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <span
                className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                    accent
                )}
            >
                {icon}
            </span>
            <div className="min-w-0">
                <p
                    className={cn(
                        "text-xl font-semibold leading-none tabular-nums",
                        accent
                    )}
                >
                    {value}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                    {label}
                </p>
            </div>
        </div>
    )
}

