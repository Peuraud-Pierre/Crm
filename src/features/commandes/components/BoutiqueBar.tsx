import { ChevronDown, Store } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { Boutique } from "@/features/commandes/types/commande.types"

interface BoutiqueSwitcherProps {
    boutique: Boutique | null
    actives: readonly Boutique[]
    onChange: (id: string) => void
}

/**
 * « Boutique : Lyon 1er ▾ » — l'identité de l'espace boutique, SIMULÉE en
 * V1. Un `<select>` natif : au téléphone, c'est la roue du système, la plus
 * rapide au pouce.
 */
export function BoutiqueSwitcher({ boutique, actives, onChange }: BoutiqueSwitcherProps) {
    return (
        <label className={cn(
            "relative flex min-h-12 items-center gap-2.5 rounded-xl border px-3",
            boutique ? "border-border bg-card" : "border-primary bg-primary/5",
        )}>
            <span className="rounded-md bg-primary/10 p-1.5 text-primary"><Store size={16} aria-hidden /></span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-xs text-muted-foreground">Vous êtes la boutique</span>
                <span className="truncate font-semibold">{boutique?.nom ?? "Choisissez votre boutique"}</span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden />
            <select
                aria-label="Boutique"
                value={boutique?.id ?? ""}
                onChange={(e) => e.target.value && onChange(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
            >
                {!boutique && <option value="">Choisir…</option>}
                {actives.map((b) => <option key={b.id} value={b.id}>{b.nom} ({b.code})</option>)}
            </select>
        </label>
    )
}

export interface BoutiqueTab<V extends string> {
    id: V
    label: string
    icon: LucideIcon
    badge?: number
}

/**
 * Onglets de l'espace boutique, fixés en bas de l'écran sur téléphone : à
 * portée de pouce, quelle que soit la hauteur défilée. Masqués au-delà de
 * `md`, où la bascule de vues habituelle prend le relais.
 */
export function BoutiqueTabBar<V extends string>({ tabs, value, onChange }: { tabs: readonly BoutiqueTab<V>[]; value: V; onChange: (v: V) => void }) {
    return (
        <nav aria-label="Espace boutique" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
            <ul className="mx-auto flex max-w-xl">
                {tabs.map(({ id, label, icon: Icon, badge }) => (
                    <li key={id} className="flex-1">
                        <button
                            type="button"
                            onClick={() => onChange(id)}
                            aria-current={value === id ? "page" : undefined}
                            className={cn(
                                "relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-xs font-medium",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
                                value === id ? "text-primary" : "text-muted-foreground",
                            )}
                        >
                            <Icon size={22} />
                            {label}
                            {!!badge && (
                                <span className="absolute right-1/4 top-2 rounded-full bg-primary px-1.5 text-3xs font-bold tabular-nums text-primary-foreground">{badge}</span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
