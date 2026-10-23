import type { ComponentType, ReactNode } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"

export type EmptyStateVariant = "default" | "search" | "error"

interface EmptyStateAction {
    label: string
    onClick: () => void
    icon?: ComponentType<{ className?: string }>
}

export interface EmptyStateProps {
    /** Icône lucide, rendue en pastille teintée (même anatomie que StatTile). */
    icon?: ComponentType<{ className?: string }>
    title: string
    description?: ReactNode
    /** Action principale — ex. « Créer un client ». */
    action?: EmptyStateAction
    /** Action discrète — ex. « Réinitialiser les filtres ». */
    secondaryAction?: EmptyStateAction
    /**
     * `search` = un filtre ne renvoie rien ; `default` = rien n'existe encore.
     * La distinction est fonctionnelle, pas décorative : les deux situations
     * n'appellent pas la même action de sortie.
     */
    variant?: EmptyStateVariant
    /** `sm` dans une carte ou une colonne, `md` pour une page entière. */
    size?: "sm" | "md"
    className?: string
}

const TONE: Record<EmptyStateVariant, string> = {
    default: "bg-muted text-muted-foreground ring-border",
    search: "bg-primary/10 text-primary ring-primary/20",
    error: "bg-destructive/10 text-destructive ring-destructive/20",
}

/**
 * État vide partagé. Animation en CSS pur (pas de framer-motion) : ce
 * composant a vocation à remplacer plus de 200 blocs écrits à la main, et
 * aucun de ces emplacements n'a besoin de gestes ni d'animation de layout.
 *
 * Voir DESIGN_SYSTEM.md §13.7 (arbre de décision CSS vs framer-motion).
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    secondaryAction,
    variant = "default",
    size = "md",
    className,
}: EmptyStateProps) {
    const ActionIcon = action?.icon
    return (
        <div
            // En variante `search`, le vide est le RÉSULTAT d'une action de
            // l'utilisateur (saisie, filtre) : sans région live, un lecteur
            // d'écran ne signale rien. En variante `default` l'état est là
            // au chargement, il est lu normalement — pas de région live.
            role={variant === "search" ? "status" : undefined}
            className={cn(
                "flex flex-col items-center justify-center text-center",
                "animate-in fade-in slide-in-from-bottom-2 duration-slow ease-out",
                size === "sm" ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
                className
            )}
        >
            {Icon && (
                <div className={cn("rounded-xl p-3 ring-1", TONE[variant])}>
                    <Icon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
                </div>
            )}
            <p
                className={cn(
                    "font-semibold text-foreground",
                    size === "sm" ? "text-sm" : "text-base"
                )}
            >
                {title}
            </p>
            {description && (
                <p className="max-w-prose text-sm text-muted-foreground">
                    {description}
                </p>
            )}
            {(action || secondaryAction) && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                    {action && (
                        <Button size={size === "sm" ? "sm" : "default"} onClick={action.onClick}>
                            {ActionIcon && <ActionIcon className="h-4 w-4" />}
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
