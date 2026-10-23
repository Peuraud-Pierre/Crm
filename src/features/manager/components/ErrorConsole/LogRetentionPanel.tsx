import { useState } from "react"
import {
    useLogRetention,
    LOG_RETENTION_MONTHS,
    type LogRetentionAudit,
} from "@/features/manager/hooks/Manager_hook/useLogRetention"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/ui/atoms/alert-dialog"
import { Bot, Check, Hand, RefreshCw, ShieldCheck, Trash2 } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

// Durées proposées (en mois) pour la purge manuelle. 1 mois sert surtout aux
// tests ; 12 mois correspond à la politique RGPD appliquée par le cron.
const PURGE_OPTIONS = [
    { value: 1, label: "1 mois" },
    { value: 3, label: "3 mois" },
    { value: 6, label: "6 mois" },
    { value: 12, label: "12 mois" },
    { value: 24, label: "24 mois" },
] as const

// Cibles sélectionnables (doivent correspondre aux table_name de la config).
const LOG_TARGETS = [
    { table: "app_logs", label: "Erreurs" },
    { table: "logs_crm", label: "CRM" },
    { table: "ticket_table", label: "Bugs" },
] as const

function formatDateFull(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatDateOnly(iso: string | null) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

function ModeBadge({ mode }: { mode: string }) {
    const automatic = mode === "automatic"
    return (
        <span
            className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                automatic
                    ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800"
                    : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
            }`}
        >
            {automatic ? (
                <Bot className="w-3 h-3" />
            ) : (
                <Hand className="w-3 h-3" />
            )}
            {automatic ? "Automatique" : "Manuelle"}
        </span>
    )
}

function AuditRow({ entry }: { entry: LogRetentionAudit }) {
    return (
        <div className="flex items-start gap-2.5 px-3 py-2.5 border border-border/40 rounded-lg mb-2 bg-muted/30">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">
                        {entry.deleted_count} log
                        {entry.deleted_count > 1 ? "s" : ""} supprimé
                        {entry.deleted_count > 1 ? "s" : ""}
                    </span>
                    <span className="shrink-0 inline-flex items-center rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {entry.table_name}
                    </span>
                    <ModeBadge mode={entry.mode} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                    Exécutée le {formatDateFull(entry.executed_at)}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                    Période supprimée :{" "}
                    {formatDateOnly(entry.oldest_deleted_at)} →{" "}
                    {formatDateOnly(entry.newest_deleted_at)} (antérieurs au{" "}
                    {formatDateOnly(entry.cutoff_at)})
                </div>
            </div>
        </div>
    )
}

export function LogRetentionPanel() {
    const { entries, loading, purging, purgeNow, refresh } = useLogRetention()
    const [purgeMonths, setPurgeMonths] = useState<number>(LOG_RETENTION_MONTHS)
    // true = saisie libre via le champ numérique ; false = préréglage.
    const [isCustom, setIsCustom] = useState(false)
    // Tables ciblées par la purge manuelle (toutes sélectionnées par défaut).
    const [targets, setTargets] = useState<string[]>(
        LOG_TARGETS.map((t) => t.table)
    )

    const monthsValid = Number.isFinite(purgeMonths) && purgeMonths >= 1
    const canPurge = monthsValid && targets.length > 0

    const toggleTarget = (table: string) =>
        setTargets((prev) =>
            prev.includes(table)
                ? prev.filter((t) => t !== table)
                : [...prev, table]
        )

    const selectedLabels = LOG_TARGETS.filter((t) =>
        targets.includes(t.table)
    ).map((t) => t.label)

    return (
        <div className="flex flex-col gap-4 sm:h-full sm:overflow-hidden">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                        <h2 className="text-base font-semibold">
                            Rétention RGPD des logs
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">
                            Les logs applicatifs de plus de{" "}
                            <strong>{LOG_RETENTION_MONTHS} mois</strong> sont
                            supprimés automatiquement chaque jour. Chaque
                            suppression est enregistrée ci-dessous.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={loading}
                        className="h-8"
                    >
                        <RefreshCw
                            className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
                        />
                        <span className="hidden sm:inline">Actualiser</span>
                    </Button>

                    <Select
                        value={isCustom ? "custom" : String(purgeMonths)}
                        onValueChange={(v) => {
                            if (v === "custom") {
                                setIsCustom(true)
                            } else {
                                setIsCustom(false)
                                setPurgeMonths(Number(v))
                            }
                        }}
                    >
                        <SelectTrigger
                            className="w-[130px] h-8 text-xs"
                            aria-label="Ancienneté à purger"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PURGE_OPTIONS.map((opt) => (
                                <SelectItem
                                    key={opt.value}
                                    value={String(opt.value)}
                                >
                                    + de {opt.label}
                                </SelectItem>
                            ))}
                            <SelectItem value="custom">
                                Personnalisé…
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    {isCustom && (
                        <div className="flex items-center gap-1.5">
                            <Input
                                type="number"
                                min={1}
                                value={
                                    Number.isFinite(purgeMonths)
                                        ? purgeMonths
                                        : ""
                                }
                                onChange={(e) =>
                                    setPurgeMonths(
                                        Math.max(
                                            1,
                                            Math.floor(
                                                Number(e.target.value)
                                            ) || 0
                                        )
                                    )
                                }
                                className="w-[72px] h-8 text-xs"
                                aria-label="Nombre de mois personnalisé"
                            />
                            <span className="text-xs text-muted-foreground">
                                mois
                            </span>
                        </div>
                    )}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={purging || !canPurge}
                                className="h-8"
                            >
                                <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
                                <span className="hidden sm:inline">
                                    {purging ? "Purge…" : "Purger"}
                                </span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    Purger {selectedLabels.join(" + ")} de plus
                                    de {purgeMonths} mois ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette purge manuelle supprime immédiatement,
                                    pour {selectedLabels.join(" et ")}, les logs
                                    antérieurs à {purgeMonths} mois. L'opération
                                    est irréversible et sera tracée dans le
                                    journal de rétention.
                                    {purgeMonths < LOG_RETENTION_MONTHS && (
                                        <span className="mt-2 block font-medium text-amber-600 dark:text-amber-500">
                                            Attention : durée plus courte que la
                                            politique de {LOG_RETENTION_MONTHS}{" "}
                                            mois.
                                        </span>
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() =>
                                        purgeNow(purgeMonths, targets)
                                    }
                                >
                                    Purger
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* ── Sélection des cibles ─────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Purger :</span>
                {LOG_TARGETS.map((t) => {
                    const active = targets.includes(t.table)
                    return (
                        <Button
                            key={t.table}
                            type="button"
                            size="sm"
                            variant={active ? "secondary" : "outline"}
                            onClick={() => toggleTarget(t.table)}
                            className="h-7 text-xs"
                            aria-pressed={active}
                        >
                            {active && <Check className="w-3 h-3 mr-1" />}
                            {t.label}
                        </Button>
                    )
                })}
            </div>

            {/* ── Journal ─────────────────────────────────────────────── */}
            <div className="sm:flex-1 sm:min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Chargement…
                    </div>
                ) : entries.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={ShieldCheck}
                        title="Aucune suppression enregistrée"
                        description="Le journal de rétention se remplit à la première purge."
                        className="h-48 border border-dashed rounded-xl"
                    />
                ) : (
                    <div className="sm:h-full overflow-y-auto overscroll-contain pr-2">
                        {entries.map((entry) => (
                            <AuditRow key={entry.id} entry={entry} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
