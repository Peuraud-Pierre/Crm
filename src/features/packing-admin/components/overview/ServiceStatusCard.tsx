import { Activity, CircleCheck, CircleSlash, RefreshCw } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"
import { formatDateTime, formatShare, formatUptime } from "@/features/packing-admin/utils/format"
import type { PackingServiceStatus } from "@/features/packing-admin/types"

interface ServiceStatusCardProps {
    configured: boolean
    reachable: boolean | null
    status: PackingServiceStatus | null
    loading: boolean
    onRefresh: () => void
}

/**
 * L'état du service en un bloc, et surtout : SA configuration effective.
 *
 * C'est ce qui répond à la première question quand la console n'affiche pas ce
 * qu'on attend — quelle instance je regarde, avec quels seuils. Sans elle, on
 * compare des chiffres de dev à une configuration de prod sans le savoir.
 */
export function ServiceStatusCard({
    configured,
    reachable,
    status,
    loading,
    onRefresh,
}: ServiceStatusCardProps) {
    const state = !configured
        ? { icon: CircleSlash, label: "Non configuré", tone: "text-muted-foreground" }
        : reachable === false
          ? { icon: CircleSlash, label: "Injoignable", tone: "text-destructive" }
          : reachable === null
            ? { icon: Activity, label: "Vérification…", tone: "text-muted-foreground" }
            : { icon: CircleCheck, label: "En ligne", tone: "text-success" }
    const StateIcon = state.icon

    return (
        <Card className="flex flex-col gap-4 p-4 sm:p-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <StateIcon className={cn("h-4 w-4 shrink-0", state.tone)} aria-hidden />
                    <h2 className="text-sm font-semibold text-foreground">
                        Service de classement — {state.label}
                    </h2>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 sm:w-auto"
                    onClick={onRefresh}
                    loading={loading}
                >
                    <RefreshCw size={13} aria-hidden />
                    Rafraîchir
                </Button>
            </header>

            {loading && !status ? (
                <Skeleton className="h-24 w-full rounded-lg" />
            ) : !status ? (
                <p className="text-sm text-muted-foreground">
                    {configured
                        ? "L'état détaillé n'est pas lisible : le service ne répond pas, ou refuse la session."
                        : "Renseignez PUBLIC_PACKING_API_URL pour voir l'état du service."}
                </p>
            ) : (
                <>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
                        <Field label="Version" value={status.version} />
                        <Field label="En route depuis" value={formatUptime(status.uptime_s)} />
                        <Field label="Démarré le" value={formatDateTime(status.started_at)} />
                        <Field label="Normaliseur" value={`v${status.normalizer_version}`} />
                        <Field
                            label="Précision cible"
                            value={formatShare(status.config.guard.target_precision)}
                        />
                        <Field
                            label="Preuves exigées"
                            value={String(status.config.guard.min_evidence)}
                        />
                        <Field label="Marge minimale" value={String(status.config.guard.min_margin)} />
                        <Field label="Taille max" value={`${status.config.max_upload_mb} Mo`} />
                    </dl>

                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <Badge variant="outline" className="font-mono text-2xs">
                            {status.config.supabase_url}
                        </Badge>
                        <Badge variant="outline" className="text-2xs">
                            logs {status.config.log_level} / {status.config.log_format}
                        </Badge>
                        <span className="text-2xs tabular-nums text-muted-foreground">
                            {status.counts.packing_lists} packing(s) — {status.counts.validee} validée(s),{" "}
                            {status.counts.a_verifier} à vérifier, {status.counts.echec} en échec
                        </span>
                    </div>
                </>
            )}
        </Card>
    )
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col">
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums text-foreground">{value}</dd>
        </div>
    )
}
