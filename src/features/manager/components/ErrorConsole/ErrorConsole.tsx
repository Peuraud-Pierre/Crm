import React, { useMemo, useState } from "react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import {
    useAppLogs,
    GROUPS_PAGE_SIZE,
    type AppLog,
    type LogLevel,
} from "@/features/manager/hooks/Manager_hook/useAppLogs"
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
import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/shared/ui/atoms/tabs"
import { LogRetentionPanel } from "./LogRetentionPanel"
import {
    AlertTriangle,
    Bug,
    Check,
    ChevronDown,
    ChevronRight,
    Clock,
    Copy,
    Globe,
    Info,
    Layers,
    Monitor,
    RefreshCw,
    Search,
    Trash2,
    User,
    Zap,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LevelConfig = {
    icon: React.ReactNode
    label: string
    border: string
    bg: string
    badge: string
    dot: string
    count: string
}

export interface GroupedLog {
    fingerprint: string
    level: string | null
    message: string | null
    occurrences: AppLog[]
    first: AppLog
    last: AppLog
    count: number
}

// ---------------------------------------------------------------------------
// Config par level — toutes les couleurs sont en classes Tailwind directes
// pour garantir la compatibilité dark/light
// ---------------------------------------------------------------------------

const LEVEL: Record<string, LevelConfig> = {
    error: {
        icon: <Bug className="w-3.5 h-3.5" />,
        label: "Erreur",
        border: "border-l-destructive",
        bg: "bg-destructive/5 hover:bg-destructive/10",
        badge: "bg-destructive/10 text-destructive border-destructive/20",
        dot: "bg-destructive",
        count: "bg-destructive/10 text-destructive",
    },
    warn: {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: "Warn",
        border: "border-l-warning",
        bg: "bg-warning/5 hover:bg-warning/10",
        badge: "bg-warning/10 text-warning border-warning/20",
        dot: "bg-warning",
        count: "bg-warning/10 text-warning",
    },
    info: {
        icon: <Info className="w-3.5 h-3.5" />,
        label: "Info",
        border: "border-l-chart-2",
        bg: "bg-transparent hover:bg-muted/60",
        badge: "bg-chart-2/10 text-chart-2 border-chart-2/20",
        dot: "bg-chart-2",
        count: "bg-chart-2/10 text-chart-2",
    },
    critical: {
        icon: <Zap className="w-3.5 h-3.5" />,
        label: "Critique",
        border: "border-l-chart-4",
        bg: "bg-chart-4/5 hover:bg-chart-4/10",
        badge: "bg-chart-4/10 text-chart-4 border-chart-4/20",
        dot: "bg-chart-4",
        count: "bg-chart-4/10 text-chart-4",
    },
}

const fallbackLevel: LevelConfig = LEVEL.info

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig(level: string | null): LevelConfig {
    return LEVEL[level ?? "info"] ?? fallbackLevel
}

/** Normalise un message pour créer une fingerprint de grouping */
function fingerprint(log: AppLog): string {
    const msg = (log.message ?? "")
        // retire les UUIDs / IDs numériques / timestamps
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "<id>")
        .replace(/\b\d{4,}\b/g, "<n>")
        .slice(0, 120)
    return `${log.level}::${msg}`
}

function formatDateShort(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatDateFull(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

function buildCopyText(group: GroupedLog): string {
    const sample = group.last
    const lines: string[] = []

    lines.push(
        `[${(group.level ?? "info").toUpperCase()}] ${group.message ?? "(no message)"}`
    )
    if (group.count > 1) lines.push(`Occurrences : ${group.count}`)
    lines.push(`Première   : ${formatDateFull(group.first.created_at)}`)
    lines.push(`Dernière   : ${formatDateFull(group.last.created_at)}`)

    if (sample.url) lines.push(`URL        : ${sample.url}`)
    if (sample.browser) lines.push(`Navigateur : ${sample.browser}`)
    if (sample.session_id) lines.push(`Session    : ${sample.session_id}`)

    if (sample.stack) {
        lines.push("")
        lines.push("Stack trace :")
        lines.push(sample.stack)
    }

    if (sample.context) {
        lines.push("")
        lines.push("Contexte :")
        lines.push(JSON.stringify(sample.context, null, 2))
    }

    return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Timeline des occurrences (mini-dots)
// ---------------------------------------------------------------------------

function OccurrenceTimeline({ occurrences }: { occurrences: AppLog[] }) {
    const [open, setOpen] = useState(false)
    const cfg = getConfig(occurrences[0]?.level ?? null)

    return (
        <div className="mt-2.5">
            <button
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((p) => !p)
                }}
            >
                <Clock className="w-3 h-3" />
                {occurrences.length} occurrence
                {occurrences.length > 1 ? "s" : ""}
                {open ? (
                    <ChevronDown className="w-3 h-3" />
                ) : (
                    <ChevronRight className="w-3 h-3" />
                )}
            </button>

            {open && (
                <div className="mt-2 space-y-0.5 pl-1 border-l-2 border-border ml-1.5">
                    {occurrences.map((occ, i) => (
                        <div
                            key={occ.id}
                            className="flex items-center gap-2 pl-2.5 text-[10px] font-mono text-muted-foreground relative"
                        >
                            <span
                                className={`absolute -left-[5px] w-2 h-2 rounded-full border-2 border-background ${cfg.dot}`}
                            />
                            <span className="tabular-nums">
                                {formatDateFull(occ.created_at)}
                            </span>
                            {occ.user_email && (
                                <span className="text-foreground/60 truncate max-w-[140px]">
                                    {occ.user_email}
                                </span>
                            )}
                            {i === 0 && (
                                <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">
                                    dernière
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Ligne de log groupée
// ---------------------------------------------------------------------------

function GroupedLogRow({ group }: { group: GroupedLog }) {
    const [expanded, setExpanded] = useState(false)
    const [copied, setCopied] = useState(false)
    const cfg = getConfig(group.level)
    const sample = group.last // afficher les détails du dernier en date

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(buildCopyText(group)).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div
            className={`border-l-2 rounded-r-lg mb-2 transition-colors border border-border/40 ${cfg.border} ${cfg.bg}`}
        >
            {/* Header */}
            <div
                role="button"
                tabIndex={0}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left cursor-pointer rounded-r-lg overflow-hidden"
                onClick={() => setExpanded((p) => !p)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                        setExpanded((p) => !p)
                }}
            >
                {/* Chevron */}
                <span className="shrink-0 text-muted-foreground mt-0.5">
                    {expanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                    )}
                </span>

                {/* Level badge */}
                <span
                    className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold mt-0.5 ${cfg.badge}`}
                >
                    {cfg.icon}
                    <span className="hidden sm:inline">{cfg.label}</span>
                </span>

                {/* Count bubble — visible si > 1 */}
                {group.count > 1 && (
                    <span
                        className={`shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold mt-0.5 ${cfg.count}`}
                    >
                        ×{group.count}
                    </span>
                )}

                {/* Message */}
                <span className="flex-1 min-w-0 text-xs font-medium text-foreground leading-snug break-words">
                    {group.message ?? "(no message)"}
                </span>

                {/* Date + user (desktop) + bouton copier */}
                <div className="shrink-0 flex items-start gap-1.5 ml-2">
                    <span className="hidden md:flex flex-col items-end gap-0.5 text-[10px] text-muted-foreground font-mono">
                        <span>{formatDateShort(group.last.created_at)}</span>
                        {group.last.user_email && (
                            <span className="truncate max-w-[120px]">
                                {group.last.user_email}
                            </span>
                        )}
                    </span>
                    <button
                        onClick={handleCopy}
                        title="Copier l'erreur (sans email)"
                        className="shrink-0 p-1 rounded hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    >
                        {copied ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                            <Copy className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="pb-3.5 border-t border-border/30 pt-3 space-y-3 ml-1">
                    {/* Meta grid */}
                    <div className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] font-mono">
                        {sample.url && (
                            <MetaLine
                                icon={<Globe className="w-3 h-3" />}
                                label="URL"
                            >
                                <a
                                    className="text-chart-2 break-all hover:underline"
                                    href={sample.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {sample.url}
                                </a>
                            </MetaLine>
                        )}
                        {sample.browser && (
                            <MetaLine
                                icon={<Monitor className="w-3 h-3" />}
                                label="Navigateur"
                            >
                                {sample.browser}
                            </MetaLine>
                        )}
                        {sample.user_email && (
                            <MetaLine
                                icon={<User className="w-3 h-3" />}
                                label="Utilisateur"
                            >
                                {sample.user_email}
                            </MetaLine>
                        )}
                        {sample.session_id && (
                            <MetaLine
                                icon={<Layers className="w-3 h-3" />}
                                label="Session"
                            >
                                <span className="text-muted-foreground">
                                    {sample.session_id}
                                </span>
                            </MetaLine>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="px-4">
                        <OccurrenceTimeline occurrences={group.occurrences} />
                    </div>

                    {/* Stack trace */}
                    {sample.stack && (
                        <div className="overflow-x-auto px-4">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                                Stack trace
                            </span>
                            <pre className="bg-muted rounded-md p-2.5 text-destructive whitespace-pre text-[10px] leading-relaxed max-h-52 border border-border/40">
                                {sample.stack}
                            </pre>
                        </div>
                    )}

                    {/* Context */}
                    {sample.context && (
                        <div className="overflow-x-auto px-4">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground block mb-1">
                                Contexte
                            </span>
                            <pre className="bg-muted rounded-md p-2.5 text-success text-[10px] leading-relaxed max-h-36 border border-border/40">
                                {JSON.stringify(sample.context, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function MetaLine({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="flex items-start gap-1.5">
            <span className="shrink-0 text-muted-foreground mt-0.5">
                {icon}
            </span>
            <div className="min-w-0">
                <span className="text-muted-foreground text-[9px] uppercase tracking-wide block">
                    {label}
                </span>
                <span className="text-foreground/90">{children}</span>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function ErrorConsole() {
    const { logs, loading, total, filters, applyFilters, clearLogs, refresh } =
        useAppLogs()

    const [searchInput, setSearchInput] = useState("")
    const [groupPage, setGroupPage] = useState(0)

    // ---- Grouping (client-side, mémoïsé) ----------------------------------
    const grouped = useMemo<GroupedLog[]>(() => {
        const map = new Map<string, GroupedLog>()

        for (const log of logs) {
            const fp = fingerprint(log)
            const existing = map.get(fp)
            if (existing) {
                existing.occurrences.push(log)
                existing.count++
                if (log.created_at > existing.last.created_at)
                    existing.last = log
                if (log.created_at < existing.first.created_at)
                    existing.first = log
            } else {
                map.set(fp, {
                    fingerprint: fp,
                    level: log.level,
                    message: log.message,
                    occurrences: [log],
                    first: log,
                    last: log,
                    count: 1,
                })
            }
        }

        return Array.from(map.values()).sort(
            (a, b) =>
                new Date(b.last.created_at).getTime() -
                new Date(a.last.created_at).getTime()
        )
    }, [logs])

    // Reset page quand les groupes changent (nouveau filtre)
    const prevGroupsLenRef = React.useRef(grouped.length)
    if (prevGroupsLenRef.current !== grouped.length) {
        prevGroupsLenRef.current = grouped.length
        if (groupPage !== 0) setGroupPage(0)
    }

    // Pagination sur les groupes
    const totalGroupPages = Math.ceil(grouped.length / GROUPS_PAGE_SIZE)
    const visibleGroups = grouped.slice(
        groupPage * GROUPS_PAGE_SIZE,
        (groupPage + 1) * GROUPS_PAGE_SIZE
    )

    // ---- Stats ---------------------------------------------------------------
    const stats = useMemo(
        () => ({
            critical: logs.filter((l) => l.level === "critical").length,
            error: logs.filter((l) => l.level === "error").length,
            warn: logs.filter((l) => l.level === "warn").length,
            groups: grouped.length,
        }),
        [logs, grouped]
    )

    // ---- Handlers ------------------------------------------------------------
    const handleSearch = (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setGroupPage(0)
        applyFilters({ ...filters, search: searchInput })
    }

    const handleLevelChange = (value: string) => {
        setGroupPage(0)
        applyFilters({ ...filters, level: value as LogLevel | "all" })
    }

    const handleClearSearch = () => {
        setSearchInput("")
        setGroupPage(0)
        applyFilters({ ...filters, search: undefined })
    }

    // ---- Render --------------------------------------------------------------
    return (
        <Tabs
            defaultValue="console"
            className="flex flex-col sm:h-full sm:overflow-hidden"
        >
            <TabsList indicator className="mx-0 mb-2 self-start">
                <TabsTrigger value="console">
                    Console d&apos;erreurs
                </TabsTrigger>
                <TabsTrigger value="retention">Rétention RGPD</TabsTrigger>
            </TabsList>

            <TabsContent
                value="retention"
                className="flex-1 sm:overflow-hidden mt-0"
            >
                <LogRetentionPanel />
            </TabsContent>

            <TabsContent
                value="console"
                className="flex-1 sm:overflow-hidden mt-0"
            >
                <div className="flex flex-col gap-4 sm:h-full sm:overflow-hidden">
                    {/* ── Header ──────────────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                                <Bug className="w-4 h-4 text-destructive" />
                                Console d&apos;erreurs
                            </h2>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {stats.critical > 0 && (
                                    <StatBadge
                                        cfg={LEVEL.critical}
                                        n={stats.critical}
                                        label="critique"
                                    />
                                )}
                                <StatBadge
                                    cfg={LEVEL.error}
                                    n={stats.error}
                                    label="erreur"
                                />
                                <StatBadge
                                    cfg={LEVEL.warn}
                                    n={stats.warn}
                                    label="warn"
                                />
                                <span className="text-xs text-muted-foreground">
                                    {stats.groups} groupe
                                    {stats.groups > 1 ? "s" : ""} · {total}{" "}
                                    entrées
                                </span>
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
                                <span className="hidden sm:inline">
                                    Actualiser
                                </span>
                            </Button>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={total === 0}
                                        className="h-8"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
                                        <span className="hidden sm:inline">
                                            Vider
                                        </span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Vider tous les logs ?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Cette action supprimera
                                            définitivement les {total} entrées.
                                            Elle est irréversible.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Annuler
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            onClick={() => clearLogs()}
                                        >
                                            Vider
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    {/* ── Filters ─────────────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                        <Select
                            value={filters.level ?? "all"}
                            onValueChange={handleLevelChange}
                        >
                            <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
                                <SelectValue placeholder="Niveau" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    Tous les niveaux
                                </SelectItem>
                                <SelectItem value="critical">
                                    Critique
                                </SelectItem>
                                <SelectItem value="error">Erreur</SelectItem>
                                <SelectItem value="warn">
                                    Avertissement
                                </SelectItem>
                                <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                        </Select>

                        <form
                            onSubmit={handleSearch}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                        >
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Message, URL, email…"
                                    value={searchInput}
                                    onChange={(e) =>
                                        setSearchInput(e.target.value)
                                    }
                                    className="h-8 text-xs pl-8 pr-6"
                                />
                                {searchInput && (
                                    <button
                                        type="button"
                                        onClick={handleClearSearch}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            <Button
                                type="submit"
                                size="sm"
                                className="h-8 text-xs shrink-0"
                            >
                                Filtrer
                            </Button>
                        </form>
                    </div>

                    {/* ── Log list ────────────────────────────────────────────── */}
                    <div className="sm:flex-1 sm:min-h-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Chargement…
                            </div>
                        ) : grouped.length === 0 ? (
                            <EmptyState
                                size="sm"
                                variant="search"
                                icon={Bug}
                                title="Aucun log correspondant aux filtres"
                                description="Élargissez la période ou retirez un filtre."
                                className="h-48 border border-dashed rounded-xl"
                            />
                        ) : (
                            <div className="sm:h-full overflow-y-auto overscroll-contain pr-2">
                                {visibleGroups.map((group) => (
                                    <GroupedLogRow
                                        key={group.fingerprint}
                                        group={group}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Pagination sur les groupes ───────────────────────────── */}
                    {totalGroupPages > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">
                                Page {groupPage + 1} / {totalGroupPages} ·{" "}
                                {stats.groups} groupes · {total} entrées
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setGroupPage((p) => Math.max(0, p - 1))
                                    }
                                    disabled={groupPage === 0}
                                    className="flex-1 sm:flex-none h-7 text-xs"
                                >
                                    Précédent
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setGroupPage((p) =>
                                            Math.min(totalGroupPages - 1, p + 1)
                                        )
                                    }
                                    disabled={groupPage >= totalGroupPages - 1}
                                    className="flex-1 sm:flex-none h-7 text-xs"
                                >
                                    Suivant
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </TabsContent>
        </Tabs>
    )
}

// ---------------------------------------------------------------------------
// Micro-composant badge stat
// ---------------------------------------------------------------------------

function StatBadge({
    cfg,
    n,
    label,
}: {
    cfg: LevelConfig
    n: number
    label: string
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium ${cfg.badge}`}
        >
            {cfg.icon}
            {n} {label}
            {n > 1 ? "s" : ""}
        </span>
    )
}
