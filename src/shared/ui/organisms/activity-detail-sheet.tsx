import type { ReactNode } from "react"
import { Clock, User } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Separator } from "@/shared/ui/atoms/separator"
import { Badge } from "@/shared/ui/atoms/badge"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import type { ModuleTheme } from "@/shared/ui/module-theme"
import type { ActivityFeedGroup, ActivityVocabulary } from "./activity-feed"

/**
 * Détail d'un groupe du journal : chaque entrée avec son diff colonne par
 * colonne.
 *
 * Pendant du feed partagé, et pour la même raison : les deux modules de stock
 * en avaient chacun un, l'un traduisant les noms de colonnes et l'autre les
 * montrant bruts. Le dessin retenu est celui du stock principal.
 *
 * Le dictionnaire de colonnes (`fieldLabels`) et le formatage des valeurs
 * (`formatValue`) restent au module : ils décrivent son schéma de base, que le
 * socle n'a pas à connaître — et les deux modules ne formatent pas à
 * l'identique, ce qui interdisait de les fondre.
 */

export interface ActivityDetailEntry {
    /** Identifiant de la LIGNE de journal — clé de rendu. */
    id: string
    /** Identifiant de l'entité concernée, quand le module l'affiche. */
    entityId?: string | null
    entityLabel: string | null
    description: string | null
    createdAt: string
    /**
     * Diff produit par le trigger. Deux formes coexistent : `{before, after}`
     * sur une modification, la valeur nue sur une création ou une suppression.
     */
    changes: Record<string, unknown> | null
}

/** Colonnes techniques, jamais utiles à la lecture d'un diff. */
const DEFAULT_HIDDEN_FIELDS: ReadonlySet<string> = new Set(["id", "created_at", "updated_at"])

interface ActivityDetailSheetProps {
    open: boolean
    onClose: () => void
    group: ActivityFeedGroup | null
    entries: readonly ActivityDetailEntry[]
    vocabulary: ActivityVocabulary
    theme: ModuleTheme
    /** Nom de l'auteur, déjà résolu ; `null` = ne rien afficher. */
    userName: string | null
    fieldLabels: Record<string, string>
    hiddenFields?: ReadonlySet<string>
    formatValue: (value: unknown) => string
    formatTime: (iso: string) => string
    formatExactTime: (iso: string) => string
    /** Complément propre au module sous chaque entrée (identifiant technique…). */
    entryFooter?: (entry: ActivityDetailEntry) => ReactNode
}

function isDiff(v: unknown): v is { before: unknown; after: unknown } {
    return (
        v !== null &&
        typeof v === "object" &&
        "before" in (v as object) &&
        "after" in (v as object)
    )
}

export function ActivityDetailSheet({
    open,
    onClose,
    group,
    entries,
    vocabulary,
    theme,
    userName,
    fieldLabels,
    hiddenFields = DEFAULT_HIDDEN_FIELDS,
    formatValue,
    formatTime,
    formatExactTime,
    entryFooter,
}: ActivityDetailSheetProps) {
    if (!group) return null

    const entityColors = theme.activity.entityColors as Record<string, string>
    const actionColors = theme.activity.actionColors as Record<string, string>

    return (
        <FormSheet
            open={open}
            onClose={onClose}
            // La pastille porte l'icône du type d'entité, déjà colorée : c'est
            // elle qui distingue une balle d'un mouvement au premier coup d'œil.
            icon={
                <span className={cn("block", entityColors[group.entity_type])}>
                    {vocabulary.entityIcon[group.entity_type]}
                </span>
            }
            title={
                <span className="flex flex-wrap items-center gap-2 font-normal">
                    <span
                        className={cn(
                            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-bold",
                            actionColors[group.action],
                        )}
                    >
                        {vocabulary.actionIcon[group.action]}
                        {vocabulary.actionLabel[group.action]}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                        {vocabulary.entityLabel[group.entity_type]}
                    </span>
                    {group.count > 1 && (
                        <Badge variant="secondary" className="text-2xs font-bold tabular-nums">
                            ×{group.count}
                        </Badge>
                    )}
                </span>
            }
            description={
                <span className="flex items-center gap-3">
                    {userName && (
                        <span className="inline-flex items-center gap-1">
                            <User size={10} aria-hidden />
                            {userName}
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                        <Clock size={10} aria-hidden />
                        {formatTime(group.created_at)}
                    </span>
                </span>
            }
            // Aucun `onSubmit` : le journal est produit par des triggers, il ne
            // s'édite pas. `FormSheet` rend alors la sheet sans pied d'action.
            size="md"
        >
            <div className="flex flex-col gap-0">
                {entries.map((entry, i) => (
                    <div key={entry.id}>
                        {i > 0 && <Separator className="my-1 opacity-50" />}
                        <div className="py-2">
                            <div className="flex items-center justify-between gap-3">
                                {/* `text-[13px]` : palier intermédiaire entre
                                    text-xs et text-sm, conservé tel quel — c'est
                                    le rendu de référence des deux modules. */}
                                <span className="text-[13px] font-mono font-semibold text-slate-700 dark:text-slate-200 truncate">
                                    {entry.entityLabel ?? "—"}
                                </span>
                                <span className="text-3xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                                    {formatExactTime(entry.createdAt)}
                                </span>
                            </div>
                            {entry.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                    {entry.description}
                                </p>
                            )}
                            <ChangesView
                                changes={entry.changes}
                                action={group.action}
                                fieldLabels={fieldLabels}
                                hiddenFields={hiddenFields}
                                formatValue={formatValue}
                            />
                            {entryFooter?.(entry)}
                        </div>
                    </div>
                ))}
            </div>
        </FormSheet>
    )
}

function ChangesView({
    changes,
    action,
    fieldLabels,
    hiddenFields,
    formatValue,
}: {
    changes: Record<string, unknown> | null
    action: string
    fieldLabels: Record<string, string>
    hiddenFields: ReadonlySet<string>
    formatValue: (value: unknown) => string
}) {
    if (!changes || Object.keys(changes).length === 0) return null

    // Une colonne dont la valeur n'a pas bougé, ou dont la valeur nue est vide,
    // n'apprend rien : la montrer noierait les changements réels.
    const entries = Object.entries(changes).filter(([key, value]) => {
        if (hiddenFields.has(key)) return false
        if (isDiff(value)) return value.before !== value.after
        return value !== null && value !== undefined && value !== ""
    })
    if (entries.length === 0) return null

    const hasDiff = entries.some(([, value]) => isDiff(value))

    return (
        <div className="mt-2 rounded-md border border-primary/20 overflow-hidden text-2xs">
            <table className="w-full">
                <tbody>
                    {entries.map(([key, value]) => (
                        <tr
                            key={key}
                            className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                            <td
                                // Largeur en style inline plutôt qu'en classe
                                // arbitraire : même mécanisme que `RecordTable`.
                                style={{ width: "38%" }}
                                className="px-2.5 py-1.5 font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-900/40"
                            >
                                {fieldLabels[key] ?? key}
                            </td>
                            <td className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300 font-mono break-all">
                                {hasDiff && isDiff(value) ? (
                                    <span className="flex items-center gap-1.5 flex-wrap">
                                        {value.before !== null && value.before !== "" && (
                                            <>
                                                <span className="line-through opacity-50">
                                                    {formatValue(value.before)}
                                                </span>
                                                <span className="opacity-30">→</span>
                                            </>
                                        )}
                                        <span
                                            className={cn(
                                                "font-medium",
                                                action === "delete"
                                                    ? "text-red-500 dark:text-red-400"
                                                    : "text-emerald-600 dark:text-emerald-400",
                                            )}
                                        >
                                            {formatValue(value.after)}
                                        </span>
                                    </span>
                                ) : (
                                    <span
                                        className={cn(
                                            action === "delete" &&
                                                "text-red-500 dark:text-red-400 opacity-80",
                                            action === "create" &&
                                                "text-emerald-600 dark:text-emerald-400",
                                        )}
                                    >
                                        {formatValue(value)}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
