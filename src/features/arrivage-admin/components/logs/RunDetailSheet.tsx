import { Inbox } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import {
    RunStatusBadge,
    RunTriggerBadge,
} from "@/features/arrivage-admin/components/shared/RunStatusBadge"
import { useRunEvents } from "@/features/arrivage-admin/hooks/data/useRunEvents"
import {
    formatBytes,
    formatDateTime,
    formatDuration,
} from "@/features/arrivage-admin/utils/format"
import type { SendRun } from "@/features/arrivage-admin/types"

const SKELETON_ROWS = ["ev1", "ev2", "ev3"]

interface RunDetailSheetProps {
    run: SendRun | null
    onOpenChange: (open: boolean) => void
}

/** Détail par destinataire d'un envoi : c'est ici que vivent les erreurs SMTP. */
export function RunDetailSheet({ run, onOpenChange }: RunDetailSheetProps) {
    const { events, loading, error } = useRunEvents(run?.id ?? null)

    return (
        <Sheet open={!!run} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>Détail de l'envoi</SheetTitle>
                    <SheetDescription>
                        {run ? formatDateTime(run.started_at) : ""}
                    </SheetDescription>
                </SheetHeader>

                {run && (
                    <div className="mt-6 space-y-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <RunTriggerBadge trigger={run.trigger} />
                            <RunStatusBadge status={run.status} />
                            <Badge variant="outline">
                                {formatDuration(run.duration_ms)}
                            </Badge>
                            <Badge variant="outline">
                                {run.rows_count} ligne(s) d'arrivage
                            </Badge>
                        </div>

                        {run.error && (
                            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                {run.error}
                            </p>
                        )}

                        <div className="space-y-3">
                            <p className="text-sm font-medium">
                                Destinataires ({run.sent_count} servis,{" "}
                                {run.failed_count} en échec)
                            </p>

                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}

                            {loading ? (
                                <div className="space-y-2">
                                    {SKELETON_ROWS.map(key => (
                                        <Skeleton
                                            key={key}
                                            className="h-16 w-full rounded-lg"
                                        />
                                    ))}
                                </div>
                            ) : events.length === 0 && !error ? (
                                <EmptyState
                                    icon={Inbox}
                                    title="Aucun destinataire"
                                    description="Cet envoi s'est arrêté avant d'atteindre le premier abonné."
                                />
                            ) : (
                                <ul className="space-y-2">
                                    {events.map(ev => (
                                        <li
                                            key={ev.id}
                                            className="rounded-lg border border-border p-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                                    {ev.email}
                                                </p>
                                                <Badge
                                                    variant={
                                                        ev.status === "sent"
                                                            ? "success"
                                                            : "destructive"
                                                    }
                                                >
                                                    {ev.status === "sent"
                                                        ? "Envoyé"
                                                        : "Échec"}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Excel{" "}
                                                {formatDuration(ev.excel_ms)} (
                                                {formatBytes(ev.xlsx_size_bytes)})
                                                {" · SMTP "}
                                                {formatDuration(ev.smtp_ms)}
                                                {ev.changed_cells !== null &&
                                                    ` · ${ev.changed_cells} cellule(s) modifiée(s)`}
                                            </p>
                                            {ev.error && (
                                                <p className="mt-2 break-words text-xs text-destructive">
                                                    {ev.error}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
