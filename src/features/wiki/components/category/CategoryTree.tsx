import { BookOpen, ChevronRight, Folder, FolderOpen } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { WIKI_THEME } from "../../theme"
import { useWikiContext } from "../../hooks/context/useWikiContext"
import type { WikiCategoryNode } from "../../types/wiki-category.types"

/**
 * Navigation arborescente (consultation) : profondeur arbitraire, dépliage,
 * révélation auto de la branche active, comptage par branche.
 * @param onNavigate appelé après une sélection (ferme le tiroir mobile).
 */
export function CategoryTree({ onNavigate }: { onNavigate?: () => void }) {
    const {
        tree,
        articles,
        selectedCategoryId,
        setSelectedCategoryId,
        setSelectedArticle,
    } = useWikiContext()

    const selectRoot = () => {
        setSelectedCategoryId(null)
        setSelectedArticle(null)
        onNavigate?.()
    }

    return (
        <nav
            className={WIKI_THEME.layout.sidebarInner}
            aria-label="Catégories du wiki"
        >
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Navigation
            </p>

            <ul role="tree" className="space-y-0.5">
                <li role="none">
                    <button
                        type="button"
                        role="treeitem"
                        aria-selected={selectedCategoryId === null}
                        onClick={selectRoot}
                        className={cn(
                            WIKI_THEME.tree.row,
                            "pl-2 w-full",
                            selectedCategoryId === null
                                ? WIKI_THEME.tree.rowActive
                                : WIKI_THEME.tree.rowIdle
                        )}
                    >
                        {selectedCategoryId === null && (
                            <span className={WIKI_THEME.tree.activeBar} />
                        )}
                        <BookOpen className="h-4 w-4 shrink-0" />
                        <span className="truncate">Tous les articles</span>
                        <span
                            className={cn(
                                WIKI_THEME.tree.count,
                                selectedCategoryId === null &&
                                    WIKI_THEME.tree.countActive
                            )}
                        >
                            {articles.length}
                        </span>
                    </button>
                </li>

                {tree.map((node) => (
                    <TreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        onNavigate={onNavigate}
                    />
                ))}
            </ul>

            {tree.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                    Aucune catégorie pour le moment.
                </p>
            )}
        </nav>
    )
}

function TreeNode({
    node,
    depth,
    onNavigate,
}: {
    node: WikiCategoryNode
    depth: number
    onNavigate?: () => void
}) {
    const {
        selectedCategoryId,
        setSelectedCategoryId,
        setSelectedArticle,
        expandedIds,
        toggleExpanded,
        forcedOpenIds,
        branchArticleCount,
    } = useWikiContext()

    const hasChildren = node.children.length > 0
    const expanded =
        hasChildren &&
        (expandedIds.has(node.id) || forcedOpenIds.has(node.id))
    const active = selectedCategoryId === node.id
    const count = branchArticleCount(node.id)

    const open = () => {
        setSelectedCategoryId(node.id)
        setSelectedArticle(null)
        if (hasChildren && !expanded) toggleExpanded(node.id)
        onNavigate?.()
    }

    return (
        <li role="none">
            <div
                role="treeitem"
                aria-expanded={hasChildren ? expanded : undefined}
                aria-selected={active}
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        open()
                    }
                }}
                className={cn(
                    WIKI_THEME.tree.row,
                    active
                        ? WIKI_THEME.tree.rowActive
                        : WIKI_THEME.tree.rowIdle
                )}
                style={{ paddingLeft: 8 + depth * 14 }}
            >
                {active && <span className={WIKI_THEME.tree.activeBar} />}

                {hasChildren ? (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                            e.stopPropagation()
                            toggleExpanded(node.id)
                        }}
                        className="shrink-0 rounded hover:bg-foreground/10"
                        aria-label={
                            expanded
                                ? `Replier ${node.name}`
                                : `Déplier ${node.name}`
                        }
                    >
                        <ChevronRight
                            className={cn(
                                WIKI_THEME.tree.chevron,
                                expanded && "rotate-90"
                            )}
                        />
                    </button>
                ) : (
                    <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}

                {expanded ? (
                    <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" />
                ) : (
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <span className="truncate">{node.name}</span>
                {count > 0 && (
                    <span
                        className={cn(
                            WIKI_THEME.tree.count,
                            active && WIKI_THEME.tree.countActive
                        )}
                        aria-label={`${count} article${count > 1 ? "s" : ""}`}
                    >
                        {count}
                    </span>
                )}
            </div>

            {hasChildren && expanded && (
                <ul
                    role="group"
                    className="animate-in fade-in slide-in-from-top-1 duration-base"
                >
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            onNavigate={onNavigate}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
}
