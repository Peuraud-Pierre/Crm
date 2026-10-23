import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/atoms/sheet"

/**
 * Coque d'une fiche de CONSULTATION — l'inverse de `form-sheet`, qui édite.
 *
 * Pourquoi ce composant existe
 * ----------------------------
 * Le stock principal avait la seule fiche de détail du dépôt : en-tête à
 * pastille, corps scrollable en sections, pied d'actions. Le handpick, lui,
 * n'avait aucun mode lecture — cliquer une balle ouvrait le formulaire
 * d'édition, si bien qu'un compte n'ayant que le droit de lecture ne pouvait
 * rien consulter. Plutôt que d'écrire une deuxième fiche, la coque monte ici.
 *
 * Ce qui monte : la géométrie du panneau, l'en-tête, la zone scrollable, le
 * pied, et les deux briques de contenu (`InfoTile`, `DetailRow`). Ce qui reste
 * dans la feature : les sections elles-mêmes, qui portent le vocabulaire métier.
 *
 * Les couleurs `slate-*` que posait la fiche du stock ont été remplacées par
 * les tokens du thème (`muted`, `border`, `foreground`), conformément à
 * CLAUDE.md. Écart de rendu faible mais réel, surtout en thème sombre.
 */

interface DetailSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Icône de la pastille d'en-tête. */
    icon: LucideIcon
    title: string
    /** Classes du titre — `font-mono` pour un code, par exemple. */
    titleClassName?: string
    /** Ligne discrète sous le titre : date, identifiant, provenance. */
    subtitle?: ReactNode
    /** Coin supérieur droit — typiquement un badge de statut. */
    badge?: ReactNode
    /** Barre d'actions collée en bas. Absente, il n'y a pas de pied. */
    footer?: ReactNode
    /**
     * `wide` pour un contenu tabulaire qu'on parcourt ligne à ligne (la
     * vérification d'une packing list) ; `default` pour une fiche.
     */
    size?: "default" | "wide"
    /** Contenu fixe entre l'en-tête et la zone défilante (barre de progression, filtres). */
    toolbar?: ReactNode
    children: ReactNode
}

export function DetailSheet({
    open,
    onOpenChange,
    icon: Icon,
    title,
    titleClassName,
    subtitle,
    badge,
    footer,
    size = "default",
    toolbar,
    children,
}: DetailSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className={cn(
                    "w-full p-0 flex flex-col gap-0 overflow-hidden",
                    size === "wide" ? "sm:max-w-3xl" : "sm:max-w-xl",
                )}
            >
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 sm:p-2.5 bg-muted rounded-xl shrink-0">
                                <Icon size={18} className="text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <SheetTitle
                                    className={cn(
                                        "text-base sm:text-lg font-black tracking-tight truncate",
                                        titleClassName,
                                    )}
                                >
                                    {title}
                                </SheetTitle>
                                {subtitle && (
                                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                        {subtitle}
                                    </div>
                                )}
                            </div>
                        </div>
                        {badge}
                    </div>
                </SheetHeader>

                {toolbar && (
                    <div className="px-6 py-3 border-b border-border bg-muted/30">{toolbar}</div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">{children}</div>

                {footer && (
                    <div className="px-4 sm:px-6 py-3 border-t border-border flex flex-row gap-2">
                        {footer}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}

/** Tuile d'information : un libellé en capitales, une ou deux valeurs. */
export function InfoTile({
    icon,
    label,
    children,
}: {
    icon: ReactNode
    label: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-1 p-2 sm:p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                {icon}
                <span className="text-3xs font-bold uppercase tracking-wider truncate">
                    {label}
                </span>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">{children}</div>
        </div>
    )
}

/**
 * Ligne libellé / valeur. `rowClassName` vient du thème du module
 * (`settings.section.row`) : la surface d'une ligne reste sa décision.
 */
export function DetailRow({
    icon,
    label,
    rowClassName,
    children,
}: {
    icon: ReactNode
    label: string
    rowClassName?: string
    children: ReactNode
}) {
    return (
        <div className={cn("flex items-center justify-between", rowClassName)}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm font-medium text-foreground">{label}</span>
            </div>
            {children}
        </div>
    )
}
