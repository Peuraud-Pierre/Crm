import type { ReactNode } from "react"
import { Clock, User, type LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/shared/ui/atoms/scroll-area"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { ModuleTheme } from "@/shared/ui/module-theme"

/**
 * Journal d'activité : liste de groupes d'actions.
 *
 * Les deux modules de stock en avaient chacun un, au dessin différent — l'un
 * avec icône d'entité, compteur `×N` et temps relatif, l'autre sans. Passer de
 * l'un à l'autre donnait l'impression de changer d'application. Celui-ci est le
 * dessin retenu (celui du stock principal, le plus riche).
 *
 * Aucun vocabulaire métier ici : « balle », « mouvement », « Créé » arrivent
 * dans `vocabulary`, fourni par le module (DESIGN_SYSTEM.md §14.3). Le
 * composant ne sait pas non plus résoudre un utilisateur — il reçoit une
 * fonction, parce que les deux modules n'ont pas le même annuaire.
 */

/** Ce que le feed a besoin de savoir d'un groupe ; chaque module en met plus. */
export interface ActivityFeedGroup {
    key: string
    action: string
    entity_type: string
    user_id: string | null
    created_at: string
    /** Nombre d'entrées regroupées. */
    count: number
    /** Affichés seulement pour un groupe d'UNE entrée : au-delà, ils ne la représenteraient pas. */
    entityLabel?: string | null
    description?: string | null
}

/** Libellés, icônes et couleurs propres au module, indexés par code. */
export interface ActivityVocabulary {
    entityLabel: Record<string, string>
    entityIcon: Record<string, ReactNode>
    actionLabel: Record<string, string>
    actionIcon: Record<string, ReactNode>
}

interface ActivityFeedProps<G extends ActivityFeedGroup> {
    groups: readonly G[]
    loading: boolean
    vocabulary: ActivityVocabulary
    theme: ModuleTheme
    /** Résout le nom affichable d'un auteur ; `null` = ne rien afficher. */
    userName: (userId: string | null) => string | null
    /** Horodatage relatif (« 5m », « 3j ») — la mise en forme reste au module. */
    formatTime: (iso: string) => string
    empty: {
        icon: LucideIcon
        title: string
        description: string
        /** Issue de secours quand le vide vient d'un filtre trop étroit. */
        action?: { label: string; onClick: () => void }
    }
    onSelect: (group: G) => void
}

export function ActivityFeed<G extends ActivityFeedGroup>({
    groups,
    loading,
    vocabulary,
    theme,
    userName,
    formatTime,
    empty,
    onSelect,
}: ActivityFeedProps<G>) {
    if (loading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, i) => `activity-skeleton-${i}`).map((key) => (
                    <Skeleton key={key} className="h-14 rounded-xl" />
                ))}
            </div>
        )
    }

    if (groups.length === 0) {
        return (
            <EmptyState
                className={theme.board.emptyState}
                icon={empty.icon}
                title={empty.title}
                description={empty.description}
                action={empty.action}
            />
        )
    }

    return (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
            <div className="flex flex-col gap-2 pr-1">
                {groups.map((group) => (
                    <ActivityRow
                        key={group.key}
                        group={group}
                        vocabulary={vocabulary}
                        theme={theme}
                        userName={userName(group.user_id)}
                        time={formatTime(group.created_at)}
                        onClick={() => onSelect(group)}
                    />
                ))}
            </div>
        </ScrollArea>
    )
}

function ActivityRow({
    group,
    vocabulary,
    theme,
    userName,
    time,
    onClick,
}: {
    group: ActivityFeedGroup
    vocabulary: ActivityVocabulary
    theme: ModuleTheme
    userName: string | null
    time: string
    onClick: () => void
}) {
    const isSingle = group.count === 1
    const entityColors = theme.activity.entityColors as Record<string, string>
    const actionColors = theme.activity.actionColors as Record<string, string>

    return (
        <div
            role="button"
            tabIndex={0}
            className={cn(
                // `activity.row` est la carte de journal du module : bordure,
                // fond `card`, rayon. Elle était définie dans les deux thèmes
                // sans être câblée nulle part, et les lignes se fondaient dans
                // l'arrière-plan de la page faute de surface propre.
                theme.activity.row,
                "items-start cursor-pointer transition-colors",
                "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
            onClick={onClick}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
        >
            {/* Icône entité */}
            <div
                className={cn(
                    "mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0",
                    entityColors[group.entity_type],
                )}
            >
                {vocabulary.entityIcon[group.entity_type]}
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                        className={cn(
                            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-3xs font-bold",
                            actionColors[group.action],
                        )}
                    >
                        {vocabulary.actionIcon[group.action]}
                        {vocabulary.actionLabel[group.action]}
                    </span>

                    {!isSingle && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-3xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                            ×{group.count}
                        </span>
                    )}

                    <span className={cn(theme.filterBar.panelLabel, "normal-case tracking-normal")}>
                        {vocabulary.entityLabel[group.entity_type]}
                    </span>

                    {isSingle && group.entityLabel && (
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px] sm:max-w-none">
                            {group.entityLabel}
                        </span>
                    )}
                </div>

                {isSingle && group.description && (
                    <p className={cn(theme.section.description, "mt-0.5 line-clamp-1 text-xs")}>
                        {group.description}
                    </p>
                )}
            </div>

            {/* Droite : auteur + temps */}
            <div className="flex flex-col items-end gap-0.5 shrink-0">
                {userName && (
                    <div className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                        <User size={9} />
                        <span className="text-3xs font-medium truncate max-w-[80px]">
                            {userName}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                    <Clock size={10} />
                    <span className="text-3xs font-medium tabular-nums">{time}</span>
                </div>
            </div>
        </div>
    )
}
