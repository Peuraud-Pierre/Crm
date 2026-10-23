import type { ComponentType, ReactNode } from "react"
import { Link } from "react-router"
import { cn } from "@/shared/lib/utils"
import type { WidgetAccent } from "@/shared/types/widget.types"

/**
 * La ligne d'un module de dashboard.
 *
 * Six modules répétaient la même anatomie — `<ul className="divide-y">`,
 * puis par ligne une icône, un titre, une méta et un élément de fin —
 * chacun avec ses propres `py-1.5`/`py-2`/`py-2.5` et son propre
 * traitement de la densité. Résultat : neuf modules empilés sur une page
 * ne s'alignaient sur rien.
 *
 * Ce fichier vit dans `shared/ui/molecules` et non dans la feature
 * dashboard, pour la même raison que `shared/types/widget.types.ts` :
 * ce sont les **features** qui déclarent leurs modules, et aucune ne doit
 * avoir à importer le dashboard. Il ne connaît aucune entité métier — il
 * reçoit du texte et des nœuds — ce qui en fait bien une molecule au sens
 * de `docs/DESIGN_SYSTEM.md` §4, déjà consommée par plus de deux
 * features.
 */

/**
 * Teinte de la pastille d'icône.
 *
 * Classes écrites en entier, jamais composées : Tailwind lit le source
 * pour savoir quoi générer, et `` `bg-${accent}/10` `` n'existerait pas
 * dans la feuille de style. Même contrainte, même solution que
 * `features/dashboard/widgets/accents.ts`.
 */
const ACCENT_PILL: Record<WidgetAccent, string> = {
    "chart-1": "bg-chart-1/10 text-chart-1",
    "chart-2": "bg-chart-2/10 text-chart-2",
    "chart-3": "bg-chart-3/10 text-chart-3",
    "chart-4": "bg-chart-4/10 text-chart-4",
    "chart-5": "bg-chart-5/10 text-chart-5",
    "chart-6": "bg-chart-6/10 text-chart-6",
    "chart-7": "bg-chart-7/10 text-chart-7",
    "chart-8": "bg-chart-8/10 text-chart-8",
}

/**
 * Ce que la ligne dit d'elle-même.
 *
 * `danger` sert à une échéance dépassée, `warning` à une échéance
 * imminente. Volontairement restreint : une ligne qui peut prendre huit
 * couleurs ne signale plus rien.
 */
export type WidgetRowEmphasis = "default" | "warning" | "danger"

const EMPHASIS_TRAILING: Record<WidgetRowEmphasis, string> = {
    default: "text-muted-foreground",
    warning: "font-medium text-warning",
    danger: "font-medium text-destructive",
}

export interface WidgetRowProps {
    /**
     * Destination de la ligne. **Omise = ligne non cliquable**, et c'est
     * un cas courant, pas une négligence : soit l'utilisateur n'a pas le
     * droit d'ouvrir la cible (voir `shared/lib/routeAccess.ts`), soit la
     * feature n'a pas de route de détail et le lien ne ferait que répéter
     * le bouton « voir tout » de l'en-tête de carte.
     */
    to?: string
    icon?: ComponentType<{ className?: string }>
    /** Teinte de la pastille d'icône. Absente = icône discrète, sans fond. */
    accent?: WidgetAccent
    /**
     * Contenu de tête à la place de l'icône, quand une valeur alignée en
     * dit plus qu'un pictogramme — l'heure d'un rendez-vous, par exemple :
     * une colonne d'heures se parcourt verticalement, six fois la même
     * icône de calendrier ne se parcourt pas du tout. Ignoré si `icon`
     * est fourni.
     */
    leading?: ReactNode
    title: ReactNode
    /** Seconde ligne. Masquée en densité compacte. */
    meta?: ReactNode
    /** Fin de ligne : une date, un badge, un compteur. */
    trailing?: ReactNode
    emphasis?: WidgetRowEmphasis
    compact?: boolean
    /** Libellé du lien pour un lecteur d'écran, si le titre ne suffit pas. */
    ariaLabel?: string
}

/**
 * La liste. Elle ne fait que poser les séparateurs — toute la densité est
 * réglée par les lignes, en un seul endroit.
 */
export function WidgetList({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return <ul className={cn("divide-y divide-border/60", className)}>{children}</ul>
}

export function WidgetRow({
    to,
    icon: Icon,
    accent,
    leading,
    title,
    meta,
    trailing,
    emphasis = "default",
    compact = false,
    ariaLabel,
}: WidgetRowProps) {
    const body = (
        <>
            {!Icon && leading && (
                <span className="mt-0.5 shrink-0">{leading}</span>
            )}

            {Icon && (
                <span
                    className={cn(
                        "flex shrink-0 items-center justify-center",
                        accent
                            ? cn(
                                  "mt-0.5 rounded-md",
                                  compact ? "size-5" : "size-6",
                                  ACCENT_PILL[accent]
                              )
                            : "mt-0.5 text-muted-foreground"
                    )}
                >
                    <Icon className={compact ? "size-3.5" : "size-4"} />
                </span>
            )}

            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                    {title}
                </span>
                {/* La méta tombe en premier quand la place manque : c'est
                    le titre qu'on vient lire, pas son contexte. */}
                {meta && !compact && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {meta}
                    </span>
                )}
            </span>

            {trailing && (
                <span
                    className={cn(
                        "shrink-0 text-xs",
                        EMPHASIS_TRAILING[emphasis]
                    )}
                >
                    {trailing}
                </span>
            )}
        </>
    )

    const shape = cn(
        "flex w-full items-start gap-2.5 px-3 text-left",
        compact ? "py-1.5" : "py-2.5"
    )

    return (
        <li>
            {to ? (
                <Link
                    to={to}
                    aria-label={ariaLabel}
                    className={cn(
                        shape,
                        // `transition-colors` et non `transition-all` : la
                        // règle ESLint le refuse, et surveiller toutes les
                        // propriétés animables d'une ligne de liste coûte
                        // un layout par survol (DESIGN_SYSTEM.md §13.9).
                        "transition-colors duration-fast hover:bg-accent hover:text-accent-foreground",
                        "focus-visible:bg-accent focus-visible:outline-none"
                    )}
                >
                    {body}
                </Link>
            ) : (
                <div className={shape}>{body}</div>
            )}
        </li>
    )
}

/**
 * Intertitre à l'intérieur d'un module qui montre deux jeux de lignes
 * (« Nouveaux » puis « Assignés à moi »). Rendu dans la liste elle-même,
 * en `<li>` de présentation : intercaler une `<section>` entre un `<ul>`
 * et ses `<li>` casserait la sémantique de la liste.
 */
export function WidgetListHeading({ children }: { children: ReactNode }) {
    return (
        <li
            role="presentation"
            className="bg-muted/40 px-3 py-1 text-3xs font-medium tracking-widest text-muted-foreground uppercase"
        >
            {children}
        </li>
    )
}
