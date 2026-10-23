import { useMemo, useState } from "react"
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragMoveEvent,
    type DragStartEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Check, CornerDownRight, FolderTree, Loader2, Plus, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { toast } from "sonner"
import {
    buildCategoryTree,
    collectBranchIds,
    computeReorder,
    flattenTreeWithDepth,
    projectDrop,
} from "../../utils/wikiTree"
import type {
    WikiCategory,
    WikiCategoryFormInput,
    WikiCategoryMove,
} from "../../types/wiki-category.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { CATEGORY_INDENT_PX, CategoryRow, IconBtn } from "./CategoryRow"

interface CategoryManagerProps {
    categories: WikiCategory[]
    loading: boolean
    onCreate: (input: WikiCategoryFormInput) => Promise<unknown>
    onUpdate: (id: string, input: Partial<WikiCategoryFormInput>) => Promise<void>
    onReorder: (moves: WikiCategoryMove[]) => Promise<void>
    onDelete: (category: WikiCategory) => void
    deletingId: string | null
}

/**
 * Gestion arborescente des catégories (profondeur arbitraire) : création,
 * renommage, suppression, et réorganisation au drag & drop.
 *
 * Le drag opère sur la liste APLATIE de l'arbre (recette dnd-kit « sortable
 * tree ») : la position verticale donne le voisin, le décalage horizontal la
 * profondeur — donc le nouveau parent. Les calculs sont dans `utils/wikiTree`
 * (purs et testés) ; ce composant ne fait que du câblage.
 */
export function CategoryManager({
    categories,
    loading,
    onCreate,
    onUpdate,
    onReorder,
    onDelete,
    deletingId,
}: CategoryManagerProps) {
    const [rootName, setRootName] = useState("")
    const [busyRoot, setBusyRoot] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")
    const [addingChildOf, setAddingChildOf] = useState<string | null>(null)
    const [childName, setChildName] = useState("")
    const [busyChild, setBusyChild] = useState(false)

    const [activeId, setActiveId] = useState<string | null>(null)
    const [overId, setOverId] = useState<string | null>(null)
    const [offsetLeft, setOffsetLeft] = useState(0)

    // Mêmes réglages que le réordonnancement des sections d'article
    // (ArticleEditor) : seuil en distance à la souris, délai au doigt pour ne
    // pas confisquer le défilement de la page, et pilotage clavier.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 6 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const flattened = useMemo(
        () => flattenTreeWithDepth(buildCategoryTree(categories)),
        [categories]
    )

    // Pendant le drag, la branche déplacée est repliée : on ne traîne qu'une
    // ligne, et ses descendants ne peuvent pas servir de cible de dépôt.
    const items = useMemo(() => {
        if (!activeId) return flattened
        const branch = collectBranchIds(categories, activeId)
        return flattened.filter(
            (i) => i.category.id === activeId || !branch.has(i.category.id)
        )
    }, [flattened, categories, activeId])

    const sortedIds = useMemo(
        () => items.map((i) => i.category.id),
        [items]
    )

    /** Cible projetée du drop courant (profondeur + parent + rang). */
    const projected = useMemo(() => {
        if (!activeId || !overId) return null
        const overIndex = items.findIndex((i) => i.category.id === overId)
        if (overIndex < 0) return null
        const withoutActive = items.filter((i) => i.category.id !== activeId)
        return projectDrop(
            withoutActive,
            overIndex,
            offsetLeft,
            CATEGORY_INDENT_PX
        )
    }, [activeId, overId, items, offsetLeft])

    const activeItem = activeId
        ? items.find((i) => i.category.id === activeId)
        : undefined

    const createRoot = async () => {
        if (!rootName.trim()) return
        try {
            setBusyRoot(true)
            await onCreate({ name: rootName.trim(), parent_id: null })
            setRootName("")
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Erreur de création"
            )
        } finally {
            setBusyRoot(false)
        }
    }

    const createChild = async (parentId: string) => {
        if (!childName.trim()) return
        try {
            setBusyChild(true)
            await onCreate({ name: childName.trim(), parent_id: parentId })
            setChildName("")
            setAddingChildOf(null)
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Erreur de création"
            )
        } finally {
            setBusyChild(false)
        }
    }

    const saveRename = async () => {
        if (!editingId || !editingName.trim()) return
        try {
            await onUpdate(editingId, { name: editingName.trim() })
            setEditingId(null)
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : "Erreur de renommage"
            )
        }
    }

    const resetDrag = () => {
        setActiveId(null)
        setOverId(null)
        setOffsetLeft(0)
    }

    const handleDragStart = ({ active }: DragStartEvent) => {
        setActiveId(String(active.id))
        setOverId(String(active.id))
    }

    const handleDragMove = ({ delta, over }: DragMoveEvent) => {
        setOffsetLeft(delta.x)
        if (over) setOverId(String(over.id))
    }

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        const target = projected
        resetDrag()
        if (!over || !target) return

        const moves = computeReorder(
            categories,
            String(active.id),
            target.parentId,
            target.index
        )
        // Tableau vide = déplacement sans effet, ou dépôt refusé (dans sa
        // propre branche) : rien à envoyer.
        if (moves.length === 0) return

        try {
            await onReorder(moves)
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Impossible de réorganiser les catégories"
            )
        }
    }

    return (
        <div className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
            <div>
                <h2 className="font-semibold">Arborescence des catégories</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    Organisez le wiki en catégories et sous-catégories (ex.
                    Stock › Arrivage › Création d'arrivage). Glissez une ligne
                    par sa poignée pour la réordonner, ou vers la droite pour la
                    ranger sous la catégorie du dessus.
                </p>
            </div>

            {/* Création d'une racine */}
            <div className="flex gap-2">
                <Input
                    placeholder="Nouvelle catégorie principale"
                    value={rootName}
                    onChange={(e) => setRootName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") createRoot()
                    }}
                />
                <Button
                    onClick={createRoot}
                    disabled={!rootName.trim()}
                    loading={busyRoot}
                    className="shrink-0 gap-2"
                >
                    {!busyRoot && <Plus className="h-4 w-4" />}
                    Ajouter
                </Button>
            </div>

            {/* Arbre */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={FolderTree}
                    title="Aucune catégorie"
                    description="Créez-en une pour commencer à ranger les articles."
                />
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    onDragCancel={resetDrag}
                >
                    <SortableContext
                        items={sortedIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="rounded-lg border">
                            {items.map(({ category, depth }) => (
                                <div key={category.id}>
                                    <CategoryRow
                                        category={category}
                                        depth={
                                            // La ligne tirée s'indente en
                                            // direct sur la cible projetée.
                                            activeId === category.id && projected
                                                ? projected.depth
                                                : depth
                                        }
                                        editing={editingId === category.id}
                                        editingName={editingName}
                                        onEditingNameChange={setEditingName}
                                        onStartEdit={() => {
                                            setEditingId(category.id)
                                            setEditingName(category.name)
                                        }}
                                        onCancelEdit={() => setEditingId(null)}
                                        onSaveEdit={saveRename}
                                        onAddChild={() => {
                                            setAddingChildOf(category.id)
                                            setChildName("")
                                        }}
                                        onDelete={() => onDelete(category)}
                                        deleting={deletingId === category.id}
                                    />

                                    {addingChildOf === category.id && (
                                        <div
                                            className="flex animate-in fade-in slide-in-from-top-1 items-center gap-2 py-1.5 pr-2 duration-fast"
                                            style={{
                                                paddingLeft:
                                                    8 +
                                                    (depth + 1) *
                                                        CATEGORY_INDENT_PX,
                                            }}
                                        >
                                            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                            <Input
                                                placeholder="Nom de la sous-catégorie"
                                                value={childName}
                                                onChange={(e) =>
                                                    setChildName(e.target.value)
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        createChild(category.id)
                                                    if (e.key === "Escape")
                                                        setAddingChildOf(null)
                                                }}
                                                className="h-8 flex-1"
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                className="h-8 gap-1.5"
                                                disabled={!childName.trim()}
                                                loading={busyChild}
                                                onClick={() =>
                                                    createChild(category.id)
                                                }
                                            >
                                                {!busyChild && (
                                                    <Check className="h-3.5 w-3.5" />
                                                )}
                                                Ajouter
                                            </Button>
                                            <IconBtn
                                                title="Annuler"
                                                onClick={() =>
                                                    setAddingChildOf(null)
                                                }
                                            >
                                                <X className="h-4 w-4" />
                                            </IconBtn>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay>
                        {activeItem ? (
                            <CategoryRow
                                overlay
                                category={activeItem.category}
                                depth={0}
                                editing={false}
                                editingName=""
                                onEditingNameChange={() => {}}
                                onStartEdit={() => {}}
                                onCancelEdit={() => {}}
                                onSaveEdit={() => {}}
                                onAddChild={() => {}}
                                onDelete={() => {}}
                                deleting={false}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
    )
}
