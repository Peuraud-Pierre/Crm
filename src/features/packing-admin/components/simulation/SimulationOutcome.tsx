import { ArrowRight, FlaskConical } from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import { formatConfidence, formatShare } from "@/features/packing-admin/utils/format"
import type {
    PackingModelStats,
    PackingReplayReport,
    PackingServiceStatus,
} from "@/features/packing-admin/types"

interface SimulationOutcomeProps {
    production: PackingServiceStatus | null
    simulatedModel: PackingModelStats | null
    simulatedReplay: PackingReplayReport | null
    loading: boolean
    error: Error | null
    hasRun: boolean
}

/**
 * Ce que le réglage essayé aurait donné, comparé à la production.
 *
 * Trois chiffres, et l'ordre compte :
 *
 *  1. **le seuil obtenu** — un réglage qui ne produit AUCUN seuil coupe
 *     l'auto-classement entièrement, ce qui est un choix, mais doit se voir ;
 *  2. **la part classée sans intervention** — le bénéfice ;
 *  3. **les auto à tort** — le coût. Un réglage qui monte le premier en
 *     produisant le troisième n'est pas un gain, c'est un transfert de risque
 *     vers quelque chose que plus personne ne relit.
 */
export function SimulationOutcome({
    production,
    simulatedModel,
    simulatedReplay,
    loading,
    error,
    hasRun,
}: SimulationOutcomeProps) {
    if (!hasRun) {
        return (
            <EmptyState
                size="sm"
                icon={FlaskConical}
                title="Aucune simulation lancée"
                description="Réglez les curseurs puis cliquez sur « Simuler » : le service rejouera l'historique validé avec ces valeurs, sans rien changer en production."
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    if (loading) {
        return (
            <div className="grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
            </div>
        )
    }

    if (error) {
        return (
            <EmptyState
                size="sm"
                icon={FlaskConical}
                title="Simulation impossible"
                description={error.message}
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    const prodModel = production?.model ?? null
    const steps = simulatedReplay?.steps ?? []
    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null
    const autoWrong = steps.reduce((sum, step) => sum + step.auto_wrong, 0)

    return (
        <div className="flex flex-col gap-3">
            <div className="grid gap-4 sm:grid-cols-3">
                <Comparison
                    label="Seuil obtenu"
                    before={prodModel?.threshold == null ? "Aucun" : formatConfidence(prodModel.threshold)}
                    after={
                        simulatedModel?.threshold == null
                            ? "Aucun"
                            : formatConfidence(simulatedModel.threshold)
                    }
                    warn={simulatedModel?.threshold == null}
                    note={
                        simulatedModel?.threshold == null
                            ? "Avec ce réglage, le modèle ne classerait plus rien seul."
                            : undefined
                    }
                />
                <Comparison
                    label="Sans intervention (dernier conteneur)"
                    before="—"
                    after={lastStep ? formatShare(lastStep.untouched_share) : "—"}
                    note="Part des lignes que personne n'aurait eu à trancher."
                />
                <Comparison
                    label="Classées seules à tort"
                    before="—"
                    after={String(autoWrong)}
                    warn={autoWrong > 0}
                    note={
                        autoWrong > 0
                            ? "Ce réglage laisserait passer des erreurs sans relecture. Le gain affiché à gauche se paie ici."
                            : "Aucune erreur d'auto-classement sur l'historique rejoué."
                    }
                />
            </div>

            <p className="text-xs text-muted-foreground">
                Mesuré en rejouant {simulatedReplay?.returned ?? 0} conteneur(s) validé(s) sur{" "}
                {simulatedReplay?.total_packings ?? 0}. Pour porter ces valeurs en production, il faut
                modifier la configuration du service (variables AUTO_TARGET_PRECISION,
                AUTO_MIN_EVIDENCE, AUTO_MIN_MARGIN) — cette interface ne l'écrit pas.
            </p>
        </div>
    )
}

function Comparison({
    label,
    before,
    after,
    warn,
    note,
}: {
    label: string
    before: string
    after: string
    warn?: boolean
    note?: string
}) {
    return (
        <Card className="flex flex-col gap-2 p-4">
            <p className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="flex items-center gap-2 text-sm">
                <span className="tabular-nums text-muted-foreground">{before}</span>
                <ArrowRight size={13} className="shrink-0 text-muted-foreground" aria-hidden />
                <span
                    className={cn(
                        "text-lg font-bold tabular-nums",
                        warn ? "text-destructive" : "text-foreground",
                    )}
                >
                    {after}
                </span>
            </p>
            {note && <p className="text-2xs text-muted-foreground">{note}</p>}
        </Card>
    )
}
