import { cn } from "@/shared/lib/utils"
import type { PackingImportRow } from "@/features/packing-admin/types"

/**
 * Répartition des lignes d'un import, en une barre empilée.
 *
 * L'ordre des segments raconte le coût décroissant pour l'humain : reconnu par le
 * tableau (rien à faire), classé par le modèle (à survoler), proposé (à
 * confirmer), rien (à trancher). Une barre où le vert domine est un import qui
 * n'a presque rien coûté.
 */
const SEGMENTS = [
    { key: "dictionary", label: "Reconnues", className: "bg-success" },
    { key: "model", label: "Classées par le modèle", className: "bg-primary" },
    { key: "suggested", label: "Proposées", className: "bg-warning" },
    { key: "none", label: "À trancher", className: "bg-muted-foreground/40" },
] as const

export function ImportsBreakdown({
    lines,
    className,
}: {
    lines: PackingImportRow["lines"]
    className?: string
}) {
    // `null` = import d'avant l'apprentissage. Afficher quatre zéros laisserait
    // croire qu'aucune ligne n'avait été reconnue, ce qui est une autre affirmation.
    if (!lines) {
        return <span className="text-2xs text-muted-foreground">non mesurée</span>
    }

    const total = SEGMENTS.reduce((sum, s) => sum + lines[s.key], 0)
    if (total === 0) return <span className="text-2xs text-muted-foreground">aucune ligne</span>

    return (
        <span
            className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
            role="img"
            aria-label={SEGMENTS.map((s) => `${lines[s.key]} ${s.label.toLowerCase()}`).join(", ")}
        >
            {SEGMENTS.map((segment) => {
                const value = lines[segment.key]
                if (value === 0) return null
                return (
                    <span
                        key={segment.key}
                        className={segment.className}
                        title={`${segment.label} : ${value}`}
                        // Largeur calculée : aucune classe utilitaire ne l'exprime.
                        style={{ width: `${(value / total) * 100}%` }}
                    />
                )
            })}
        </span>
    )
}
