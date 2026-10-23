import type { ComponentType, ReactNode } from "react"
import { staggerStyle } from "@/shared/lib/motion"
import { Card } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"

export type StatTileTone = "primary" | "success" | "warning" | "destructive"

interface StatTileProps {
    icon: ComponentType<{ className?: string }>
    label: string
    value: ReactNode
    tone?: StatTileTone
    loading?: boolean
    /** Position dans la bande — pilote le décalage du stagger d'entrée. */
    index?: number
    /** Rend la tuile actionnable (ex. filtrer sur cette stat). */
    onClick?: () => void
    /** Reflète l'état de filtre courant quand `onClick` est fourni. */
    active?: boolean
    /** Ligne secondaire sous le label : précision, tendance. */
    hint?: ReactNode
}

const TONE_CLASSES: Record<StatTileTone, string> = {
    primary: "bg-primary/10 text-primary ring-primary/20",
    success: "bg-success/10 text-success ring-success/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    destructive: "bg-destructive/10 text-destructive ring-destructive/20",
}

/**
 * Tuile KPI partagée (anatomie du StatCard de CRM Analytics) : pastille
 * icône teintée, valeur tabulaire, label discret. Domaine-agnostique —
 * consommée par Administration et Profil.
 *
 * Entrée en CSS pur, conformément à l'arbre de décision de DESIGN_SYSTEM.md
 * §13.7 : une cascade d'apparition n'a besoin ni de sortie animée, ni de
 * layout, ni de gestes. Elle passait auparavant par framer-motion, ce qui
 * imposait en plus un `usePrefersReducedMotion()` par tuile — une
 * souscription globale dans ce qui est de fait une ligne de liste, que
 * §13.5 interdit. La media query globale suffit ici : elle remet
 * `animation-delay` à zéro, donc rien ne reste masqué.
 */
export function StatTile({
    icon: Icon,
    label,
    value,
    tone = "primary",
    loading = false,
    index = 0,
    onClick,
    active = false,
    hint,
}: StatTileProps) {
    return (
        <div
            style={staggerStyle(index, { step: 80 })}
            className="h-full animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-emphasized"
        >
            <Card
                variant={onClick ? "interactive" : "default"}
                onClick={onClick}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                onKeyDown={
                    onClick
                        ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault()
                                  onClick()
                              }
                          }
                        : undefined
                }
                className={cn(
                    // Pas de hover ici : quand la tuile est cliquable,
                    // `variant="interactive"` pose déjà l'élévation et le
                    // léger décollement ; quand elle ne l'est pas, un hover
                    // serait une affordance mensongère (card.tsx §13).
                    "flex h-full items-center gap-4 border-border/50 bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6",
                    active && "ring-2 ring-primary"
                )}
            >
                <div
                    className={cn(
                        "shrink-0 rounded-xl p-2.5 ring-1",
                        TONE_CLASSES[tone]
                    )}
                >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                    {loading ? (
                        <Skeleton className="h-8 w-12" />
                    ) : (
                        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">
                            {value}
                        </p>
                    )}
                    <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                        {label}
                    </p>
                    {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
                </div>
            </Card>
        </div>
    )
}
