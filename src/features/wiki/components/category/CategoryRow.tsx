import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
    Check,
    ChevronRight,
    CornerDownRight,
    Folder,
    GripVertical,
    Loader2,
    Pencil,
    Plus,
    Trash2,
    X,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import type { WikiCategory } from "../../types/wiki-category.types"

/** Largeur d'un niveau d'indentation. Sert aussi à projeter la profondeur
 *  visée pendant un drag (voir `projectDrop`) — les deux doivent rester alignés. */
export const CATEGORY_INDENT_PX = 18

export interface CategoryRowProps {
    category: WikiCategory
    depth: number
    /** Renommage inline en cours sur cette ligne. */
    editing: boolean
    editingName: string
    onEditingNameChange: (value: string) => void
    onStartEdit: () => void
    onCancelEdit: () => void
    onSaveEdit: () => void
    onAddChild: () => void
    onDelete: () => void
    deleting: boolean
    /** Rendu figé dans le DragOverlay : ni tri, ni actions. */
    overlay?: boolean
}

/**
 * Une ligne de l'arborescence des catégories : poignée de déplacement,
 * indentation, renommage inline et actions. Extraite de `CategoryManager`
 * pour garder ce dernier sous le seuil god-component (CLAUDE.md §15).
 */
export function CategoryRow({
    category,
    depth,
    editing,
    editingName,
    onEditingNameChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onAddChild,
    onDelete,
    deleting,
    overlay = false,
}: CategoryRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id, disabled: overlay || editing })

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                paddingLeft: 8 + depth * CATEGORY_INDENT_PX,
            }}
            className={cn(
                "group flex items-center gap-2 rounded-lg py-1.5 pr-2 transition-colors hover:bg-muted/60",
                // La ligne d'origine reste en place mais s'efface : le repère
                // visuel du déplacement, c'est le DragOverlay.
                isDragging && "opacity-40",
                overlay && "bg-card shadow-lg ring-1 ring-border"
            )}
        >
            <Button
                ref={setActivatorNodeRef}
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Déplacer ${category.name}`}
                title="Déplacer"
                // touch-none : sans lui le navigateur traite le geste comme un
                // défilement et le drag ne démarre jamais au doigt.
                className="h-7 w-6 shrink-0 cursor-grab touch-none text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="h-4 w-4" />
            </Button>

            {depth > 0 ? (
                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            )}
            <Folder className="h-4 w-4 shrink-0 text-primary/70" />

            {editing ? (
                <>
                    <Input
                        value={editingName}
                        onChange={(e) => onEditingNameChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onSaveEdit()
                            if (e.key === "Escape") onCancelEdit()
                        }}
                        className="h-8 flex-1"
                        autoFocus
                    />
                    <IconBtn title="Enregistrer" onClick={onSaveEdit}>
                        <Check className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn title="Annuler" onClick={onCancelEdit}>
                        <X className="h-4 w-4" />
                    </IconBtn>
                </>
            ) : (
                <>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {category.name}
                    </span>
                    {!overlay && (
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <IconBtn
                                title="Ajouter une sous-catégorie"
                                onClick={onAddChild}
                            >
                                <Plus className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn title="Renommer" onClick={onStartEdit}>
                                <Pencil className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                                title="Supprimer"
                                destructive
                                disabled={deleting}
                                onClick={onDelete}
                            >
                                {deleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4" />
                                )}
                            </IconBtn>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export function IconBtn({
    children,
    title,
    onClick,
    disabled,
    destructive,
}: {
    children: React.ReactNode
    title: string
    onClick: () => void
    disabled?: boolean
    destructive?: boolean
}) {
    return (
        <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
                "h-8 w-8 shrink-0",
                destructive && "text-destructive hover:bg-destructive/10"
            )}
            title={title}
            aria-label={title}
            disabled={disabled}
            onClick={onClick}
        >
            {children}
        </Button>
    )
}
