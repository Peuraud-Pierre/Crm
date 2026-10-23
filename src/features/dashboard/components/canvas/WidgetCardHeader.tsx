import type { ComponentType } from "react"
import { Link } from "react-router"
import {
    ArrowUpRight,
    Copy,
    GripVertical,
    MoreVertical,
    Settings2,
    Trash2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"

interface Props {
    title: string
    icon: ComponentType<{ className?: string }>
    /** Classes de la pastille d'accent, résolues par la carte. */
    accentPill: string
    editing: boolean
    /** Cible du « voir tout », déjà filtrée par les permissions. */
    href?: string
    /** Attributs de la poignée de déplacement (dnd-kit). */
    dragHandle: Record<string, unknown>
    onOpenSettings: () => void
    onDuplicate: () => void
    onRemove: () => void
}

/**
 * L'ourlet de commandes d'un module.
 *
 * Au repos le chrome s'efface : un titre discret, et rien d'autre tant
 * que la souris n'est pas dessus. C'est le contenu qu'on vient lire, pas
 * les boutons qui l'entourent. En mode édition il apparaît en entier —
 * poignée, menu, actions d'instance.
 *
 * Séparé de `WidgetCard` parce que les deux changent pour des raisons
 * différentes : la carte porte la géométrie et le cycle de vie du module,
 * cet en-tête ne porte que ses commandes.
 */
export function WidgetCardHeader({
    title,
    icon: Icon,
    accentPill,
    editing,
    href,
    dragHandle,
    onOpenSettings,
    onDuplicate,
    onRemove,
}: Props) {
    return (
        <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border/50 bg-muted/30 px-3">
            {editing ? (
                <button
                    type="button"
                    className="cursor-grab touch-none text-muted-foreground transition-colors duration-fast hover:text-foreground active:cursor-grabbing"
                    aria-label={`Déplacer ${title}`}
                    {...dragHandle}
                >
                    <GripVertical className="size-4" />
                </button>
            ) : (
                <span
                    className={cn("shrink-0 rounded-md p-1 ring-1", accentPill)}
                >
                    <Icon className="size-3.5" />
                </span>
            )}

            <h3 className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                {title}
            </h3>

            {/* En édition les commandes sont l'objet même de la
                page : elles restent visibles. Au repos elles
                s'effacent, mais un menu ouvert les retient —
                sinon le chrome disparaît sous le menu déroulant
                dès que la souris s'en écarte. */}
            <div
                className={cn(
                    "flex shrink-0 items-center gap-0.5 transition-opacity duration-fast",
                    editing
                        ? "opacity-100"
                        : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
                )}
            >
                {!editing && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label={`Réglages de ${title}`}
                        onClick={onOpenSettings}
                    >
                        <Settings2 className="size-3.5" />
                    </Button>
                )}

                {!editing && href && (
                    <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="size-6"
                    >
                        <Link to={href} aria-label={`Ouvrir ${title}`}>
                            <ArrowUpRight className="size-3.5" />
                        </Link>
                    </Button>
                )}

                {editing && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                aria-label={`Options de ${title}`}
                            >
                                <MoreVertical className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={onOpenSettings}>
                                <Settings2 className="size-4" />
                                Réglages
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={onDuplicate}>
                                <Copy className="size-4" />
                                Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={onRemove}
                            >
                                <Trash2 className="size-4" />
                                Retirer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </header>
    )
}
