import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"
import { cn } from "@/shared/lib/utils"
import { staggerStyle } from "@/shared/lib/motion"

// Alternance et largeurs figées plutôt qu'aléatoires : un squelette qui change
// de forme à chaque rendu attire l'œil au lieu de préparer à la lecture.
const ROWS = [
    { id: "a", mine: false, width: "w-40" },
    { id: "b", mine: false, width: "w-56" },
    { id: "c", mine: true, width: "w-32" },
    { id: "d", mine: false, width: "w-48" },
    { id: "e", mine: true, width: "w-44" },
]

/**
 * Squelette sur-mesure du fil de conversation. DESIGN_SYSTEM.md §13.8 valide
 * une forme dédiée quand celle du contenu attendu est particulière — ici des
 * bulles alternées, qu'aucun preset ne reproduit.
 */
export function MessagesSkeleton({ className }: { className?: string }) {
    return (
        <SkeletonGroup
            label="Chargement des messages"
            className={cn("flex flex-col gap-3", className)}
        >
            {ROWS.map((row, index) => (
                <div
                    key={row.id}
                    style={staggerStyle(index, { step: 60, cap: 300 })}
                    className={cn(
                        "flex animate-in fade-in fill-mode-backwards duration-slow ease-out",
                        row.mine ? "justify-end" : "justify-start"
                    )}
                >
                    <Skeleton className={cn("h-9 rounded-2xl", row.width)} />
                </div>
            ))}
        </SkeletonGroup>
    )
}
