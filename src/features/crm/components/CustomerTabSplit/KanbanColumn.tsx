import React, { memo, useRef, useCallback, useMemo, useEffect } from "react"
import {
    List,
    useDynamicRowHeight,
    useListRef,
    type RowComponentProps,
} from "react-window"
import { Card } from "@/shared/ui/atoms/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/atoms/tooltip"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { cn } from "@/shared/lib/utils"
import { COLUMN_NAMES, COLUMN_TOOLTIPS } from "@/shared/utils/CrmTab"
import { Info, Loader2 } from "lucide-react"
import { useCustomers } from "../../context/CustomerContext"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useInfiniteQuery } from "@tanstack/react-query"
import { columnQueryOptions } from "@/features/crm/hooks/data/useClientsCache"
import { ClientCard } from "./ClientCard"
import { getBriefField } from "@/features/crm/utils/invariants"
import type { TaskStatus } from "@/features/crm/utils/crmCompute"

interface KanbanColumnProps {
    colName: string
    index: number
    clients: Client[]
    onDragOver: (event: React.DragEvent) => void
    onDrop: (colName: string) => void
    draggedClientId?: string
    onDragStart: (client: Client) => void
}

const EXPERIENCE_SCORE: Record<string, number> = {
    "+ 3 ans": 3,
    "1 - 3 ans": 2,
    "0 - 1 ans": 1,
    Nouveau: 0,
}

// `useDynamicRowHeight` mesure les vraies hauteurs DOM via ResizeObserver
// et les met en cache — indispensable car la card a une hauteur variable
// (nom qui wrap via `break-all`, lignes brief sans truncate, LiveTimer qui
// peut faire wrap le header, bouton CalendarOff h-7…). Une estimation
// statique causait des chevauchements.
const ROW_GAP = 8
const DEFAULT_ROW_HEIGHT = 92 // approximation pour le premier rendu / SSR

// --- Props passées au composant Row (mémoïsé en dehors pour éviter
// les re-renders cascade quand le parent change). ---
interface RowProps {
    clients: Client[]
    clientTaskMap: Map<string, TaskStatus>
    draggedClientId?: string
    onDragStart: (client: Client) => void
    onClick: (client: Client) => void
}

const Row = ({
    index,
    style,
    clients,
    clientTaskMap,
    draggedClientId,
    onDragStart,
    onClick,
}: RowComponentProps<RowProps>) => {
    const client = clients[index]
    if (!client) return null
    return (
        <div style={style} className="px-2">
            <div
                style={{
                    paddingBottom: ROW_GAP,
                    animationDelay: `${Math.min(index * 40, 320)}ms`,
                }}
                className="animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-slow ease-out"
            >
                <ClientCard
                    client={client}
                    taskStatus={
                        (client.id && clientTaskMap.get(client.id)) || "none"
                    }
                    isDragging={draggedClientId === client.id}
                    onDragStart={onDragStart}
                    onClick={onClick}
                />
            </div>
        </div>
    )
}

export const KanbanColumn = memo(function KanbanColumn({
    colName,
    index,
    clients,
    onDragOver,
    onDrop,
    draggedClientId,
    onDragStart,
}: KanbanColumnProps) {
    const {
        activeTab,
        clientTaskMap,
        handleClientClick,
        scrollResetToken,
        searchTerm,
        scope,
    } = useCustomers()
    const { clientCountsByColumn } = useCRMContext()

    const collumIndex = COLUMN_NAMES.indexOf(colName)
    const dbCountForCol = clientCountsByColumn[collumIndex]
    const inMemoryCount = clients.length
    // Pendant une recherche, `clientCountsByColumn` reste le total DB non
    // filtré (la RPC de comptage ne connaît pas le terme de recherche) — un
    // badge qui affiche ce total à côté de cartes filtrées par la recherche
    // est trompeur (ex. "42" alors qu'une seule carte correspond). On bascule
    // alors sur le compte réel des résultats en mémoire pour cette colonne.
    const isSearching = searchTerm.trim() !== ""
    // Liste infinie de la colonne (cache TanStack). Ses données remontent au
    // board via CustomerContext (useCachedClients), qui applique les filtres
    // et le tri ; cette colonne ne pilote que le chargement. Pendant une
    // recherche, le board affiche les résultats de recherche : pas de fetch.
    const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage } =
        useInfiniteQuery({
            ...columnQueryOptions(scope, collumIndex),
            enabled: !isSearching,
        })
    // Affichage du badge : total DB de la colonne (la colonne n'en a chargé
    // qu'une partie tant qu'on n'a pas fait défiler jusqu'au bout).
    const totalCount = Math.max(
        typeof dbCountForCol === "number" ? dbCountForCol : 0
    )
    const badgeLabel = isSearching
        ? `${inMemoryCount}`
        : dbCountForCol || inMemoryCount < totalCount
          ? `${totalCount}`
          : totalCount
    const isLoadingThisColumn = isFetching

    const isShared =
        (colName.includes("Decouverte") || colName.includes("Achat")) &&
        activeTab === "fidelisation"

    // Tri stable par score d'expérience (DESC), tiebreak position d'origine.
    const sortedClients = useMemo(() => {
        const scored = clients.map((c, i) => ({
            c,
            i,
            score:
                EXPERIENCE_SCORE[getBriefField(c.brief, "experience") ?? ""] ??
                -1,
        }))
        scored.sort((a, b) => b.score - a.score || a.i - b.i)
        return scored.map((s) => s.c)
    }, [clients])

    // Mémoïse les rowProps pour ne pas déclencher de re-render de la List à
    // chaque rendu parent (la List re-render ses rows quand rowProps change).
    const rowProps = useMemo<RowProps>(
        () => ({
            clients: sortedClients,
            clientTaskMap,
            draggedClientId,
            onDragStart,
            onClick: handleClientClick,
        }),
        [
            sortedClients,
            clientTaskMap,
            draggedClientId,
            onDragStart,
            handleClientClick,
        ]
    )

    // Mesure dynamique des hauteurs (ResizeObserver interne à react-window).
    // `key` invalide le cache si la liste change radicalement (drag-drop entre
    // colonnes, filtre user qui rebascule, etc.).
    const dynamicRowHeight = useDynamicRowHeight({
        defaultRowHeight: DEFAULT_ROW_HEIGHT,
        key: collumIndex,
    })

    const handleRowsRendered = useCallback(
        ({ stopIndex }: { startIndex: number; stopIndex: number }) => {
            if (
                hasNextPage &&
                !isFetchingNextPage &&
                stopIndex >= sortedClients.length - 3
            ) {
                void fetchNextPage()
            }
        },
        [hasNextPage, isFetchingNextPage, sortedClients.length, fetchNextPage]
    )

    // Backfill : une colonne dont toutes les cartes chargées sont masquées par
    // les filtres (date, expérience, tâche) n'a aucune ligne à faire défiler,
    // donc handleRowsRendered ne déclenche jamais la page suivante. On en
    // charge une, une seule fois par contexte (reset via scrollResetToken),
    // pour ne pas parcourir toute la colonne si rien ne correspond.
    const autoBackfilledRef = useRef(false)
    useEffect(() => {
        autoBackfilledRef.current = false
    }, [scrollResetToken, collumIndex])
    useEffect(() => {
        if (
            inMemoryCount === 0 &&
            hasNextPage &&
            !isFetching &&
            !autoBackfilledRef.current &&
            !isSearching
        ) {
            autoBackfilledRef.current = true
            void fetchNextPage()
        }
    }, [inMemoryCount, hasNextPage, isFetching, fetchNextPage, isSearching])

    const listRef = useListRef(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollResetToken === 0) return
        // listRef is a stable ref object — intentionally excluded from deps
        listRef.current?.scrollToRow({ index: 0, behavior: "instant" })
    }, [scrollResetToken])

    // preventDefault : sans lui le navigateur reprend la main sur le dépôt
    // (Firefox tente d'ouvrir la donnée transportée).
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            onDrop(colName)
        },
        [onDrop, colName]
    )

    return (
        <Card
            onDragOver={onDragOver}
            onDrop={handleDrop}
            style={{ animationDelay: `${index * 80}ms` }}
            className={cn(
                "flex flex-col h-full bg-muted/20 border-t-4 snap-center shrink-0 transition-colors w-[85vw] sm:w-[280px]",
                "animate-in fade-in slide-in-from-left-12 fill-mode-backwards duration-slower ease-overshoot",
                index < 2
                    ? "border-t-chart-2"
                    : index < 4
                      ? "border-t-chart-4"
                      : "border-t-chart-1",
                colName === "Dormant"
                    ? "border-t-muted-foreground/50 bg-muted/30"
                    : "",
                isShared
                    ? "opacity-90 border-dashed border-t-chart-4/50"
                    : ""
            )}
        >
            <div className="h-12 px-3 border-b bg-background/80 backdrop-blur sticky top-0 z-10 flex justify-between items-center rounded-t-lg shrink-0">
                <h3 className="font-semibold text-sm flex items-center gap-2 truncate max-w-[200px]">
                    <span className="truncate">{colName}</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded-full text-[10px] text-muted-foreground font-mono shrink-0">
                        {badgeLabel}
                    </span>
                </h3>
                <Tooltip>
                    <TooltipTrigger className="shrink-0">
                        <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-primary transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p className="text-xs">{COLUMN_TOOLTIPS[colName]}</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Wrapper en flex-1 : la List remplit la hauteur via style.height
                = 100% (react-window v2 ne prend pas de prop `height` — c'est
                le CSS qui gouverne). */}
            <div ref={wrapperRef} className="flex-1 min-h-0 pt-2 relative">
                {sortedClients.length > 0 ? (
                    <List
                        listRef={listRef}
                        rowCount={sortedClients.length}
                        rowHeight={dynamicRowHeight}
                        rowComponent={Row}
                        rowProps={rowProps}
                        onRowsRendered={handleRowsRendered}
                        overscanCount={3}
                        style={{ height: "100%", width: "100%" }}
                        className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    />
                ) : (
                    <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed rounded-lg border-muted-foreground/10 mx-2 mt-2 opacity-50">
                        <span className="text-xs text-muted-foreground font-medium select-none">
                            Vide
                        </span>
                    </div>
                )}

                {isLoadingThisColumn && (
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center p-2 opacity-50 pointer-events-none bg-gradient-to-t from-background/80 to-transparent">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
        </Card>
    )
})
