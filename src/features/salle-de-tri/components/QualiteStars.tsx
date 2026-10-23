import { Star } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { Qualite } from "@/features/salle-de-tri/types/tri.types"

const LEVELS: Qualite[] = [1, 2, 3]

interface QualiteStarsProps {
    value: number | null
    /** Absent : affichage seul. */
    onChange?: (value: Qualite) => void
    size?: "sm" | "md"
    /** Nom accessible du groupe en saisie (« Qualité ligne 2 »). */
    label?: string
}

/**
 * Qualité d'une ligne de tri, de 1★ à 3★.
 *
 * En saisie : un groupe radio — les flèches et les chiffres 1 à 3 changent la
 * valeur au clavier, pour enchaîner les lignes sans souris. En lecture, une
 * moyenne (2,27) s'affiche en étoiles pleines arrondies et en chiffre exact.
 */
export function QualiteStars({ value, onChange, size = "md", label = "Qualité" }: QualiteStarsProps) {
    const px = size === "sm" ? 14 : 18
    const filled = value === null ? 0 : Math.round(value)

    if (!onChange) {
        return (
            <span
                className="inline-flex items-center gap-0.5"
                aria-label={value === null ? "Qualité non renseignée" : `Qualité ${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} sur 3`}
            >
                {LEVELS.map((level) => (
                    <Star
                        key={level}
                        size={px}
                        aria-hidden
                        className={level <= filled ? "fill-warning text-warning" : "text-muted-foreground/40"}
                    />
                ))}
            </span>
        )
    }

    const onKeyDown = (event: React.KeyboardEvent) => {
        const current = (value ?? 0) as number
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault()
            onChange(Math.min(3, current + 1) as Qualite)
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault()
            onChange(Math.max(1, current - 1) as Qualite)
        } else if (["1", "2", "3"].includes(event.key)) {
            event.preventDefault()
            onChange(Number(event.key) as Qualite)
        }
    }

    return (
        <div role="radiogroup" aria-label={label} className="inline-flex items-center" onKeyDown={onKeyDown}>
            {LEVELS.map((level) => {
                const checked = value === level
                return (
                    <button
                        key={level}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={`${level} étoile${level > 1 ? "s" : ""}`}
                        // Un seul arrêt de tabulation dans le groupe : la valeur
                        // courante, ou la première étoile si rien n'est choisi.
                        tabIndex={checked || (value === null && level === 1) ? 0 : -1}
                        onClick={() => onChange(level)}
                        className={cn(
                            "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        )}
                    >
                        <Star
                            size={px}
                            aria-hidden
                            className={level <= filled ? "fill-warning text-warning" : "text-muted-foreground/40 hover:text-warning/60"}
                        />
                    </button>
                )
            })}
        </div>
    )
}
