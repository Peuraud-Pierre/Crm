import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface VueOption<V extends string> {
    id: V
    label: string
    shortLabel?: string
    icon: LucideIcon
    /** Pastille de compte (écarts, retards…) ; masquée à 0. */
    badge?: number
}

interface VueToggleProps<V extends string> {
    vues: readonly VueOption<V>[]
    value: V
    onChange: (vue: V) => void
    className?: string
}

/**
 * Bascule entre les vues internes d'un onglet (Fiches / Statistiques,
 * Planning / Réception…), même dessin que celle de l'Historique. La vue est
 * portée par l'URL (`?vue=`) côté appelant : ce composant ne fait qu'afficher.
 */
export function VueToggle<V extends string>({ vues, value, onChange, className }: VueToggleProps<V>) {
    return (
        <div className={cn("relative flex rounded-lg border border-border/50 bg-muted/50 p-1", "w-full overflow-x-auto sm:w-fit", className)} role="tablist">
            {vues.map(({ id, label, shortLabel, icon: Icon, badge }) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={value === id}
                    onClick={() => onChange(id)}
                    className={cn(
                        "flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        value === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Icon size={12} />
                    <span className="hidden md:inline">{label}</span>
                    <span className="md:hidden">{shortLabel ?? label}</span>
                    {!!badge && (
                        <span className="rounded-full bg-destructive px-1.5 text-3xs font-bold tabular-nums text-destructive-foreground">
                            {badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
