import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface SectionTab<V extends string> {
    id: V
    label: string
    icon: LucideIcon
    /** Compteur affiché à côté du libellé ; masqué à 0. */
    count?: number
    /** Compteur d'alerte (litiges) : rouge plutôt que neutre. */
    alert?: boolean
}

interface SectionTabsProps<V extends string> {
    tabs: readonly SectionTab<V>[]
    value: V
    onChange: (id: V) => void
    className?: string
}

/**
 * Barre d'onglets de la page, soulignée et pleine largeur : on voit d'un
 * coup d'œil où l'on est et ce qui attend dans chaque section. La section
 * est portée par l'URL (`?vue=`) côté appelant ; ce composant ne fait
 * qu'afficher.
 */
export function SectionTabs<V extends string>({ tabs, value, onChange, className }: SectionTabsProps<V>) {
    return (
        <nav className={cn("-mx-4 overflow-x-auto border-b border-border px-4", className)} aria-label="Sections">
            <ul className="flex min-w-max gap-1" role="tablist">
                {tabs.map(({ id, label, icon: Icon, count, alert }) => {
                    const active = value === id
                    return (
                        <li key={id}>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => onChange(id)}
                                className={cn(
                                    "relative flex h-12 items-center gap-2 rounded-t-lg px-3.5 text-sm font-semibold transition-colors",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                                    active ? "text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                )}
                            >
                                <Icon size={16} />
                                {label}
                                {!!count && (
                                    <span className={cn(
                                        "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                                        alert ? "bg-destructive text-destructive-foreground"
                                            : active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                                    )}>
                                        {count}
                                    </span>
                                )}
                                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden />}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
