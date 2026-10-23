import { ChevronRight } from "lucide-react"
import { useState, type ReactNode } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { cn } from "@/shared/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { SkeletonTable } from "@/shared/ui/molecules/skeleton-presets"
import type { MatomoQuery } from "@/features/matomo/services/matomoService"
import BlockError from "./BlockError"
import { fmtShare, SearchEngineSources, ShareBar, SourceList } from "./ChannelSources"
import Panel from "./Panel"
import type { MatomoChannel } from "./types"
import { fmtChannelLabel, fmtInt } from "../utils/format"
import type { MatomoSource } from "../utils/sources"

/** Codes `referrer_type` de Matomo utiles ici. */
const DIRECT = 1
const SEARCH = 2

interface ChannelRow {
    /** Clé React : le libellé, sauf pour les canaux sans nom (repli « — »). */
    key: string
    label: string
    visits: number
    /** Part des visites de la période, en %. */
    share: number
    /** `null` sans visite : un ratio sur zéro n'a pas de sens. */
    actionsPerVisit: number | null
    /** Ce que le dépliage montre ; `none` = pas de chevron. */
    detail: "sources" | "search" | "direct" | "none"
    sources?: MatomoSource[]
}

function toRows(channels: MatomoChannel[]): ChannelRow[] {
    const total = channels.reduce((sum, c) => sum + (Number(c.nb_visits) || 0), 0)
    return channels
        .map((c, i): ChannelRow => {
            const visits = Number(c.nb_visits) || 0
            const type = Number(c.referrer_type)
            return {
                key: c.label || `sans-libelle-${i}`,
                label: c.label ? fmtChannelLabel(c.label) : "—",
                visits,
                share: total > 0 ? (visits / total) * 100 : 0,
                actionsPerVisit:
                    visits > 0 ? (Number(c.nb_actions) || 0) / visits : null,
                // Moteurs : la sous-table ne contient que des mots-clés masqués,
                // les noms des moteurs viennent d'une route dédiée.
                detail:
                    type === SEARCH
                        ? "search"
                        : type === DIRECT
                          ? "direct"
                          : c.subtable?.length
                            ? "sources"
                            : "none",
                sources: c.subtable,
            }
        })
        .sort((a, b) => b.visits - a.visits)
}

const fmtRatio = (v: number | null) =>
    v === null ? "—" : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })

/** Contenu déplié d'un canal. */
function ChannelDetail({ row, query }: { row: ChannelRow; query: MatomoQuery }) {
    if (row.detail === "search") return <SearchEngineSources query={query} channel={row.label} />
    if (row.detail === "direct")
        return (
            <p className="text-xs text-muted-foreground">
                Adresse tapée, favori, ou lien depuis une application qui ne transmet pas sa
                provenance : Matomo ne peut pas en dire plus.
            </p>
        )
    return <SourceList sources={row.sources} channel={row.label} />
}

/** En-tête de canal : bouton de dépliage s'il y a un détail, simple libellé sinon. */
function ChannelToggle({
    row,
    open,
    controls,
    onToggle,
    children,
}: {
    row: ChannelRow
    open: boolean
    controls: string
    onToggle: () => void
    children: ReactNode
}) {
    if (row.detail === "none") return <span className="min-w-0 truncate">{children}</span>
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={controls}
            className="-mx-1 flex min-w-0 items-center gap-1 rounded-sm px-1 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <ChevronRight
                aria-hidden
                className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-fast",
                    open && "rotate-90"
                )}
            />
            <span className="min-w-0 truncate">{children}</span>
        </button>
    )
}

export default function MatomoChannels({
    channels,
    query,
}: {
    channels: UseQueryResult<MatomoChannel[]>
    /** Plage courante, pour le détail des moteurs (chargé au dépliage). */
    query: MatomoQuery
}) {
    const rows = toRows(channels.data ?? [])
    // Plusieurs canaux peuvent être ouverts ensemble, pour comparer.
    const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
    const toggle = (key: string) =>
        setOpen((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    const detailId = (key: string, where: string) =>
        `canal-${where}-${key.replace(/\W+/g, "-")}`

    return (
        <Panel title="Canaux d'acquisition" busy={channels.isPlaceholderData}>
            {channels.isPending ? (
                <SkeletonTable rows={4} columns={3} label="Chargement des canaux…" />
            ) : channels.isError ? (
                <BlockError
                    error={channels.error}
                    onRetry={() => channels.refetch()}
                    retrying={channels.isFetching}
                />
            ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucune visite sur la période.
                </p>
            ) : (
                <>
                    {/* Sous md : liste empilée. Quatre colonnes chiffrées ne
                        tiennent pas sur un téléphone sans défilement horizontal.
                        Pas de RecordTable : son repli rend chaque ligne en
                        <Button>, mensonger pour des lignes qui ne s'ouvrent pas. */}
                    <ul className="divide-y divide-border/60 md:hidden">
                        {rows.map((c) => {
                            const id = detailId(c.key, "m")
                            const isOpen = open.has(c.key)
                            return (
                                <li key={c.key} className="space-y-1.5 py-3">
                                    <div className="flex items-baseline justify-between gap-3 text-sm font-medium">
                                        <ChannelToggle
                                            row={c}
                                            open={isOpen}
                                            controls={id}
                                            onToggle={() => toggle(c.key)}
                                        >
                                            {c.label}
                                        </ChannelToggle>
                                        <span className="shrink-0 font-normal tabular-nums">
                                            {fmtInt(c.visits)}{" "}
                                            <span className="text-xs text-muted-foreground">
                                                ({fmtShare(c.share)} du total)
                                            </span>
                                        </span>
                                    </div>
                                    <ShareBar share={c.share} />
                                    <p className="text-xs text-muted-foreground">
                                        {fmtRatio(c.actionsPerVisit)} actions par visite
                                    </p>
                                    {isOpen && (
                                        <div id={id} className="ml-5 pt-2">
                                            <ChannelDetail row={c} query={query} />
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>

                    <Table className="hidden md:table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Canal</TableHead>
                                <TableHead className="text-right">
                                    Visites (part du total)
                                </TableHead>
                                {/* Pas de « Visiteurs uniques » : sur une plage,
                                    Matomo ne donne par canal que la somme des
                                    uniques de chaque jour, un chiffre gonflé.
                                    « Actions par visite » remplace « Utilisateurs »,
                                    toujours 0 sur un site vitrine. */}
                                <TableHead className="text-right">Actions par visite</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.flatMap((c) => {
                                const id = detailId(c.key, "d")
                                const isOpen = open.has(c.key)
                                const row = (
                                    <TableRow key={c.key}>
                                        <TableCell className="font-medium">
                                            <ChannelToggle
                                                row={c}
                                                open={isOpen}
                                                controls={id}
                                                onToggle={() => toggle(c.key)}
                                            >
                                                {c.label}
                                            </ChannelToggle>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="tabular-nums">
                                                    {fmtInt(c.visits)}
                                                </span>
                                                <span className="text-xs tabular-nums text-muted-foreground">
                                                    {fmtShare(c.share)}
                                                </span>
                                            </div>
                                            <div className="mt-1.5">
                                                <ShareBar share={c.share} />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmtRatio(c.actionsPerVisit)}
                                        </TableCell>
                                    </TableRow>
                                )
                                if (!isOpen) return [row]
                                return [
                                    row,
                                    <TableRow key={`${c.key}-detail`} className="hover:bg-transparent">
                                        <TableCell id={id} colSpan={3} className="pt-0 pl-9">
                                            <div className="max-w-md">
                                                <ChannelDetail row={c} query={query} />
                                            </div>
                                        </TableCell>
                                    </TableRow>,
                                ]
                            })}
                        </TableBody>
                    </Table>
                </>
            )}
        </Panel>
    )
}
