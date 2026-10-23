import { Check, Plus, RotateCcw, Rows3, Rows4, SlidersHorizontal } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/ui/atoms/alert-dialog"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import type { LayoutDensity } from "../../types/layout.types"

interface Props {
    editing: boolean
    canEdit: boolean
    density: LayoutDensity
    /** Une disposition personnelle existe — sinon rien à réinitialiser. */
    personal: boolean
    onToggleEditing: () => void
    onOpenCatalog: () => void
    onDensityChange: (density: LayoutDensity) => void
    onReset: () => void
}

/**
 * Les commandes d'agencement du canevas.
 *
 * Le mode édition est explicite. Sur une page traversée plusieurs fois
 * par jour, une grille modifiable en permanence produirait des
 * déplacements accidentels — et c'est du travail d'agencement, pas de
 * consultation.
 *
 * **Elles flottent, elles ne s'intercalent pas.** En ligne, elles
 * occupaient une bande pleine largeur entre les annonces et le premier
 * module : une barre grise coincée entre deux contenus, qui séparait ce
 * que la page essaie de rapprocher. Ici, une pastille posée en bas à
 * droite, au-dessus du canevas — présente sans rien pousser.
 */
export function DashboardToolbar({
    editing,
    canEdit,
    density,
    personal,
    onToggleEditing,
    onOpenCatalog,
    onDensityChange,
    onReset,
}: Props) {
    const nextDensity: LayoutDensity =
        density === "compact" ? "comfortable" : "compact"

    return (
        // Aucun positionnement ici : c'est le pied de `Dashboard.tsx` qui
        // colle la pastille et l'ourlet ensemble. Une barre d'outils qui
        // se place elle-même devrait connaître la hauteur de ce qu'elle
        // surplombe — c'était le `bottom-14` codé en dur d'avant.
        <div className="pointer-events-none">
            <div
                className={cn(
                    "pointer-events-auto flex flex-wrap items-center gap-1 rounded-full border p-1.5 shadow-raised backdrop-blur-sm transition-colors duration-base",
                    editing
                        ? "border-primary/40 bg-card"
                        : "border-border/60 bg-card/90"
                )}
            >
                {editing && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full"
                            onClick={onOpenCatalog}
                        >
                            <Plus className="size-4" />
                            Ajouter un module
                        </Button>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full"
                                    aria-label={
                                        nextDensity === "compact"
                                            ? "Passer en affichage dense"
                                            : "Passer en affichage aéré"
                                    }
                                    onClick={() => onDensityChange(nextDensity)}
                                >
                                    {density === "compact" ? (
                                        <Rows4 className="size-4" />
                                    ) : (
                                        <Rows3 className="size-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {density === "compact"
                                    ? "Affichage dense"
                                    : "Affichage aéré"}
                            </TooltipContent>
                        </Tooltip>

                        {/* « Réinitialiser » n'a de sens que si une
                            disposition personnelle existe. */}
                        {personal && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-full"
                                    >
                                        <RotateCcw className="size-4" />
                                        Réinitialiser
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Réinitialiser le tableau de bord ?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Votre disposition personnelle sera
                                            effacée et vous retrouverez celle
                                            prévue pour votre rôle.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Annuler
                                        </AlertDialogCancel>
                                        <AlertDialogAction onClick={onReset}>
                                            Réinitialiser
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </>
                )}

                {canEdit ? (
                    <Button
                        variant={editing ? "default" : "ghost"}
                        size="sm"
                        className="rounded-full"
                        onClick={onToggleEditing}
                    >
                        {editing ? (
                            <>
                                <Check className="size-4" />
                                Terminer
                            </>
                        ) : (
                            <>
                                <SlidersHorizontal className="size-4" />
                                Personnaliser
                            </>
                        )}
                    </Button>
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {/* Un bouton désactivé n'émet pas d'évènement de
                                survol : c'est le span qui porte l'infobulle. */}
                            <span tabIndex={0}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-full"
                                    disabled
                                >
                                    <SlidersHorizontal className="size-4" />
                                    Personnaliser
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            Agencez votre tableau de bord depuis un écran plus
                            large. Vos modules restent tous visibles ici.
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    )
}
