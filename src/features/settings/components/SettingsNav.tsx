import type { ComponentType } from "react"
import { cn } from "@/shared/lib/utils"
import type { SettingsSection } from "../constants"

export interface SettingsNavItem {
    value: SettingsSection
    label: string
    description: string
    icon: ComponentType<{ className?: string }>
}

interface SettingsNavProps {
    items: SettingsNavItem[]
    active: SettingsSection
    onSelect: (section: SettingsSection) => void
}

/**
 * Sommaire de l'espace Paramètres : rail vertical à partir de `lg`, bandeau
 * horizontal scrollable en dessous. Anatomie reprise de
 * `features/stock/components/settings/SettingsBoard.tsx`, mais uniquement
 * en tokens du design system (celui-ci passe par `GESTION_THEME` et des
 * valeurs arbitraires, proscrits par CLAUDE.md).
 */
export function SettingsNav({ items, active, onSelect }: SettingsNavProps) {
    return (
        <nav
            aria-label="Sections des paramètres"
            className={cn(
                "flex shrink-0 flex-row gap-2 overflow-x-auto pb-2",
                "lg:w-64 lg:flex-col lg:overflow-visible lg:pb-0",
                // Le bandeau mobile défile sans afficher sa barre.
                "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            )}
        >
            {items.map(({ value, label, description, icon: Icon }) => {
                const isActive = value === active
                return (
                    <button
                        key={value}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => onSelect(value)}
                        className={cn(
                            "flex shrink-0 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            "lg:w-full lg:items-start",
                            isActive
                                ? "border-primary bg-muted font-medium text-foreground"
                                : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <Icon
                            className={cn(
                                "h-4 w-4 shrink-0 lg:mt-0.5",
                                isActive ? "text-primary" : undefined
                            )}
                        />
                        <span className="min-w-0">
                            <span className="block whitespace-nowrap lg:whitespace-normal">
                                {label}
                            </span>
                            <span className="hidden text-xs text-muted-foreground lg:block">
                                {description}
                            </span>
                        </span>
                    </button>
                )
            })}
        </nav>
    )
}
