import { ArrowRight, Bot } from "lucide-react"
import { Link } from "react-router"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import type { PackingModelStats } from "@/features/stock/types/packing-list.types"
import { learningStatusLine } from "@/features/stock/utils/packingLearning"

interface PackingLearningSummaryProps {
    stats: PackingModelStats | null
    loading: boolean
    error: boolean
}

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`)

/**
 * Ce que le classement a appris, et ce que vaut sa parole.
 *
 * C'est l'indicateur de la promesse de la feature : chaque confirmation humaine
 * enseigne le modèle, et la part des lignes que PERSONNE n'a eu à trancher doit
 * monter d'un conteneur au suivant. La précision affichée n'est pas une
 * estimation : c'est le taux de propositions du modèle que les utilisateurs ont
 * retenues telles quelles.
 *
 * Volontairement réduit à une AMORCE. Le détail par import vivait ici ; il est
 * désormais dans la console `/packing-admin`, plus riche et paginée. Garder les
 * deux aurait produit deux implémentations des mêmes nombres, qui finissent
 * toujours par diverger — ce dépôt en a déjà payé le prix ailleurs. Les quatre
 * stats restent, parce qu'elles sont utiles LÀ OÙ l'on classe, et elles viennent
 * du même `GET /model/stats` que la console : rien n'est recalculé de ce côté.
 */
export function PackingLearningSummary({ stats, loading, error }: PackingLearningSummaryProps) {
    const { hasPermission } = useAuth()
    const canSupervise = hasPermission(STOCK_PERMISSIONS.packingAdmin)

    // Sans service (faux import de dev), il n'y a pas de modèle à décrire.
    if (!loading && !error && stats === null) return null

    return (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <header className="flex items-center gap-2">
                <Bot size={15} className="shrink-0 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold text-foreground">Apprentissage</h3>
            </header>

            {loading ? (
                <p className="text-xs text-muted-foreground">Chargement…</p>
            ) : error || !stats ? (
                <p className="text-xs text-muted-foreground">
                    Le service d'import ne répond pas : l'état de l'apprentissage est indisponible.
                </p>
            ) : (
                <>
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="Décisions apprises" value={String(stats.examples)} />
                        <Stat label="Propositions vérifiées" value={String(stats.evidence)} />
                        <Stat label="Précision mesurée" value={percent(stats.overall_precision)} />
                        <Stat
                            label="Classement seul"
                            value={stats.threshold === null ? "Inactif" : `dès ${percent(stats.threshold)}`}
                            tone={stats.threshold === null ? "muted" : "primary"}
                        />
                    </dl>

                    {/* La phrase vient de `utils/packingLearning` : la même est
                        affichée dans la vérification d'une packing list, là où
                        l'effort est fourni. Deux rédactions des mêmes nombres
                        finissent toujours par diverger. */}
                    <p className="text-xs text-muted-foreground">{learningStatusLine(stats).text}</p>

                    {canSupervise && (
                        <Link
                            to="/packing-admin/pilotage"
                            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary transition-colors duration-fast hover:underline"
                        >
                            Console de supervision
                            <ArrowRight size={13} aria-hidden />
                        </Link>
                    )}
                </>
            )}
        </section>
    )
}

interface StatProps {
    label: string
    value: string
    tone?: "default" | "muted" | "primary"
}

function Stat({ label, value, tone = "default" }: StatProps) {
    return (
        <div className="flex flex-col">
            <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    "text-sm font-semibold tabular-nums",
                    tone === "primary" && "text-primary",
                    tone === "muted" && "text-muted-foreground",
                    tone === "default" && "text-foreground",
                )}
            >
                {value}
            </dd>
        </div>
    )
}
