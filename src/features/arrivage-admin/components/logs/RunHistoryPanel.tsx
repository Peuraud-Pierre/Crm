import { useMemo, useState } from "react"
import { History } from "lucide-react"
import { motion } from "framer-motion"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { PaginationFooter } from "@/features/arrivage-admin/components/shared/PaginationFooter"
import { RefreshButton } from "@/features/arrivage-admin/components/shared/RefreshButton"
import {
    RunStatusBadge,
    RunTriggerBadge,
} from "@/features/arrivage-admin/components/shared/RunStatusBadge"
import {
    RUNS_PAGE_SIZE,
    RUN_STATUS_LABELS,
} from "@/features/arrivage-admin/constants"
import { formatDateTime, formatDuration } from "@/features/arrivage-admin/utils/format"
import type { RunStatus, SendRun } from "@/features/arrivage-admin/types"

const SKELETON_KEYS = ["rh1", "rh2", "rh3", "rh4"]

/** Valeur du Select signifiant « pas de filtre » — "" est refusé par Radix. */
const ALL_STATUSES = "all"

interface RunHistoryPanelProps {
    runs: SendRun[]
    loading: boolean
    error: string | null
    status: RunStatus | ""
    onStatusChange: (status: RunStatus | "") => void
    onRefresh: () => void
    onSelect: (run: SendRun) => void
}

export function RunHistoryPanel({
    runs,
    loading,
    error,
    status,
    onStatusChange,
    onRefresh,
    onSelect,
}: RunHistoryPanelProps) {
    const reducedMotion = usePrefersReducedMotion()
    const [page, setPage] = useState(0)

    // Un changement de filtre change le jeu de résultats : rester en page 3
    // afficherait une page vide sans explication. La remise à zéro se fait
    // dans le gestionnaire plutôt que dans un effet — le changement de statut
    // est toujours une action utilisateur, il n'y a rien à « synchroniser ».
    const handleStatusChange = (next: RunStatus | "") => {
        setPage(0)
        onStatusChange(next)
    }

    const totalPages = Math.max(1, Math.ceil(runs.length / RUNS_PAGE_SIZE))
    const visibleRuns = useMemo(
        () => runs.slice(page * RUNS_PAGE_SIZE, (page + 1) * RUNS_PAGE_SIZE),
        [runs, page]
    )

    const isEmpty = !loading && runs.length === 0

    const rowMotion = (index: number) => ({
        initial: reducedMotion ? false : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2, delay: Math.min(index, 10) * 0.02 },
    })

    return (
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>Historique des envois</CardTitle>
                    <div className="flex shrink-0 items-center gap-2">
                        <Select
                            value={status === "" ? ALL_STATUSES : status}
                            onValueChange={v =>
                                handleStatusChange(
                                    v === ALL_STATUSES ? "" : (v as RunStatus)
                                )
                            }
                        >
                            <SelectTrigger
                                className="w-36"
                                aria-label="Filtrer par statut d'envoi"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_STATUSES}>
                                    Tous statuts
                                </SelectItem>
                                {(
                                    Object.keys(RUN_STATUS_LABELS) as RunStatus[]
                                ).map(s => (
                                    <SelectItem key={s} value={s}>
                                        {RUN_STATUS_LABELS[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <RefreshButton
                            loading={loading}
                            onClick={onRefresh}
                            label="l'historique des envois"
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0" aria-busy={loading}>
                {error && (
                    <p className="px-4 pb-4 text-sm text-destructive sm:px-6">
                        {error}
                    </p>
                )}

                {isEmpty && !error ? (
                    <EmptyState
                        icon={History}
                        title={
                            status === ""
                                ? "Aucun envoi enregistré"
                                : "Aucun envoi avec ce statut"
                        }
                        description={
                            status === ""
                                ? "Chaque diffusion, automatique ou manuelle, laissera ici une trace avec son détail par destinataire."
                                : "Choisissez « Tous statuts » pour revoir l'ensemble de l'historique."
                        }
                    />
                ) : (
                    <>
                        {/* Desktop : table */}
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Origine</TableHead>
                                        <TableHead>Statut</TableHead>
                                        <TableHead>Destinataires</TableHead>
                                        <TableHead>Durée</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading
                                        ? SKELETON_KEYS.map(key => (
                                              <TableRow key={key}>
                                                  <TableCell colSpan={5}>
                                                      <Skeleton className="h-6 w-full" />
                                                  </TableCell>
                                              </TableRow>
                                          ))
                                        : visibleRuns.map(run => (
                                              <TableRow
                                                  key={run.id}
                                                  onClick={() => onSelect(run)}
                                                  className="cursor-pointer transition-colors"
                                              >
                                                  <TableCell className="text-sm">
                                                      {formatDateTime(
                                                          run.started_at
                                                      )}
                                                  </TableCell>
                                                  <TableCell>
                                                      <RunTriggerBadge
                                                          trigger={run.trigger}
                                                      />
                                                  </TableCell>
                                                  <TableCell>
                                                      <RunStatusBadge
                                                          status={run.status}
                                                      />
                                                  </TableCell>
                                                  <TableCell className="text-sm text-muted-foreground">
                                                      {run.sent_count}/
                                                      {run.subscribers_total}
                                                      {run.failed_count > 0 &&
                                                          ` · ${run.failed_count} échec(s)`}
                                                  </TableCell>
                                                  <TableCell className="text-sm">
                                                      {formatDuration(
                                                          run.duration_ms
                                                      )}
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile : cartes */}
                        <div className="space-y-3 p-4 md:hidden">
                            {loading
                                ? SKELETON_KEYS.map(key => (
                                      <Skeleton
                                          key={key}
                                          className="h-28 w-full rounded-lg"
                                      />
                                  ))
                                : visibleRuns.map((run, index) => (
                                      <motion.div key={run.id} {...rowMotion(index)}>
                                          <Card
                                              onClick={() => onSelect(run)}
                                              role="button"
                                              tabIndex={0}
                                              onKeyDown={e => {
                                                  if (
                                                      e.key === "Enter" ||
                                                      e.key === " "
                                                  ) {
                                                      e.preventDefault()
                                                      onSelect(run)
                                                  }
                                              }}
                                              className="cursor-pointer space-y-3 p-4 transition-shadow hover:shadow-lg"
                                          >
                                              <div className="flex items-start justify-between gap-2">
                                                  <p className="text-sm font-medium">
                                                      {formatDateTime(
                                                          run.started_at
                                                      )}
                                                  </p>
                                                  <RunStatusBadge
                                                      status={run.status}
                                                  />
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                  <RunTriggerBadge
                                                      trigger={run.trigger}
                                                  />
                                                  <p className="text-sm text-muted-foreground">
                                                      {run.sent_count}/
                                                      {run.subscribers_total} ·{" "}
                                                      {formatDuration(
                                                          run.duration_ms
                                                      )}
                                                  </p>
                                              </div>
                                          </Card>
                                      </motion.div>
                                  ))}
                        </div>

                        {!loading && (
                            <PaginationFooter
                                pageIndex={page}
                                totalPages={totalPages}
                                hasPrevious={page > 0}
                                hasNext={page < totalPages - 1}
                                onPrevious={() => setPage(p => p - 1)}
                                onNext={() => setPage(p => p + 1)}
                            />
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
