import type { ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { SectionSize } from "../../types/analytics"

interface SortableSectionProps {
    id: string
    className?: string
    size: SectionSize
    onToggleSize: () => void
    children: ReactNode
}

/**
 * Enveloppe un module de l'onglet Analytics (paliers, chaque graphique)
 * pour le rendre réordonnable au glisser-déposer et redimensionnable —
 * recette dnd-kit reprise de ArticleEditor.tsx (liste plate, sans
 * profondeur à calculer). Poignée + bouton flottants plutôt qu'une barre
 * de titre : chaque widget a déjà sa propre Card avec son titre, on ne
 * veut pas la dédoubler.
 *
 * N'est monté que pendant le mode édition de la disposition (voir
 * AnalyticsTab.tsx) : le Header (filtres, racine `position: sticky`) et
 * les KPIs (grille interne pleine largeur) n'entrent jamais dans ce
 * périmètre — voir SectionKey pour le détail des deux raisons.
 */
export function SortableSection({
    id,
    className,
    size,
    onToggleSize,
    children,
}: SortableSectionProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn("relative", isDragging && "z-10 opacity-80", className)}
        >
            <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1">
                <button
                    type="button"
                    aria-label={
                        size === "full"
                            ? "Réduire le module en demi-largeur"
                            : "Agrandir le module en pleine largeur"
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={onToggleSize}
                >
                    {size === "full" ? (
                        <Minimize2 className="h-3.5 w-3.5" />
                    ) : (
                        <Maximize2 className="h-3.5 w-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    aria-label="Réordonner le module (glisser, ou flèches au clavier)"
                    className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </div>
            {children}
        </div>
    )
}
