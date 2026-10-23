import { BookCheck, Bot, ShieldCheck, Target, TriangleAlert } from "lucide-react"
import { StatTile } from "@/shared/components/misc/StatTile"
import { formatShare } from "@/features/packing-admin/utils/format"
import type { PackingImportRow, PackingReplayReport, PackingServiceStatus } from "@/features/packing-admin/types"
import { LearningCurveChart } from "./LearningCurveChart"
import { ServiceStatusCard } from "./ServiceStatusCard"

interface OverviewTabProps {
    service: {
        configured: boolean
        reachable: boolean | null
        status: PackingServiceStatus | null
        loading: boolean
        refetch: () => void | Promise<void>
    }
    replay: { replay: PackingReplayReport | null; loading: boolean }
    imports: PackingImportRow[]
    importsLoading: boolean
}

/**
 * Onglet « Pilotage » — l'essentiel en un écran.
 *
 * L'ordre n'est pas décoratif : d'abord le service (sans lui, tout le reste est
 * un état passé), puis ce que vaut le modèle, puis la courbe. Les tuiles
 * réutilisent `StatTile`, qui porte son propre stagger d'entrée.
 */
export function OverviewTab({ service, replay, imports, importsLoading }: OverviewTabProps) {
    const model = service.status?.model ?? null
    const steps = replay.replay?.steps ?? []

    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null
    const autoWrong = steps.reduce((sum, step) => sum + step.auto_wrong, 0)
    const failed = imports.filter((row) => row.status === "echec").length

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <ServiceStatusCard
                configured={service.configured}
                reachable={service.reachable}
                status={service.status}
                loading={service.loading}
                onRefresh={() => void service.refetch()}
            />

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                <StatTile
                    icon={ShieldCheck}
                    label="Classées sans intervention"
                    value={lastStep ? formatShare(lastStep.untouched_share) : "—"}
                    tone="success"
                    loading={replay.loading}
                    index={0}
                />
                <StatTile
                    icon={Target}
                    label="Précision mesurée"
                    value={formatShare(model?.overall_precision)}
                    tone="primary"
                    loading={service.loading}
                    index={1}
                />
                <StatTile
                    icon={Bot}
                    label="Classement seul"
                    value={
                        model?.threshold == null ? "Inactif" : `dès ${formatShare(model.threshold)}`
                    }
                    tone={model?.threshold == null ? "warning" : "primary"}
                    loading={service.loading}
                    index={2}
                />
                <StatTile
                    icon={BookCheck}
                    label="Correspondances apprises"
                    value={model?.dictionary_entries ?? 0}
                    tone="primary"
                    loading={service.loading}
                    index={3}
                />
                <StatTile
                    icon={TriangleAlert}
                    label="Auto à tort"
                    value={autoWrong}
                    // Le seul chiffre qui doit rester à zéro : toute valeur non
                    // nulle est une erreur passée sans regard humain.
                    tone={autoWrong > 0 ? "destructive" : "success"}
                    loading={replay.loading}
                    index={4}
                />
            </div>

            {/* min-w-0 : sans ça, le ResponsiveContainer du graphe empêche la
                colonne de grille de rétrécir. */}
            <div className="grid gap-4 sm:gap-6 [&>*]:min-w-0">
                <LearningCurveChart replay={replay.replay} loading={replay.loading} />
            </div>

            {!importsLoading && imports.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    {imports.length} import(s) au journal
                    {failed > 0 && `, dont ${failed} en échec`}.{" "}
                    {model && `Le modèle a appris de ${model.examples} décision(s) humaine(s).`}
                </p>
            )}
        </div>
    )
}
