import { AlertTriangle, CheckCheck, FileCheck2, FileQuestion, FileWarning, Search } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Progress } from "@/shared/ui/atoms/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/atoms/tooltip"
import { cn } from "@/shared/lib/utils"
import type {
    PackingGap,
    PackingListSummary,
    PackingModelStats,
} from "@/features/stock/types/packing-list.types"
import {
    packingFileIntegrity,
    type PackingReviewProgress,
    type PackingSort,
} from "@/features/stock/utils/packingGrouping"
import { formatKg, formatPackages, formatQty, formatSigned } from "./packingFormat"
import { PackingLearningNote } from "./PackingLearningNote"

export type PackingReviewFilter = "to_review" | "all" | "reviewed"

const FILTERS: { value: PackingReviewFilter; label: string }[] = [
    { value: "to_review", label: "À classer" },
    { value: "all", label: "Tous" },
    { value: "reviewed", label: "Acquis" },
]

/**
 * L'ordre par défaut classe par risque (colis décroissants) : c'est le bon pour
 * arbitrer, le pire pour traiter une famille de libellés d'un coup.
 */
const SORTS: { value: PackingSort; label: string }[] = [
    { value: "risque", label: "Par risque" },
    { value: "libelle", label: "Par libellé" },
]

interface PackingReviewToolbarProps {
    summary: PackingListSummary
    progress: PackingReviewProgress
    gap: PackingGap | null
    /**
     * Le titre du fichier correspond-il au conteneur de l'arrivage ?
     * `null` quand la question n'a pas de réponse.
     */
    containerMatches: boolean | null
    /**
     * La référence cherchée dans le titre — le n° de conteneur interne de
     * l'arrivage. L'alerte doit la NOMMER : « ne correspond pas » sans dire à
     * quoi n'indique pas quoi corriger.
     */
    expectedContainerRef?: string | null
    /** État de l'apprentissage. `null` : service non configuré ou injoignable. */
    modelStats: PackingModelStats | null
    filter: PackingReviewFilter
    onFilterChange: (filter: PackingReviewFilter) => void
    labelQuery: string
    onLabelQueryChange: (query: string) => void
    sort: PackingSort
    onSortChange: (sort: PackingSort) => void
    /** Absent : pas de droit de validation. */
    onValidate?: () => void
    validating: boolean
}

/**
 * Barre fixe au-dessus de la vérification : l'état du FICHIER, où on en est,
 * et la sortie. Elle ne défile pas — c'est ce qu'on consulte entre deux
 * groupes.
 *
 * Deux contrôles cohabitent, et il ne faut pas les confondre :
 *
 *  · l'INTÉGRITÉ DU FICHIER — le document se recoupe-t-il lui-même ? C'est le
 *    contrôle qui dispense de relire 180 lignes : si les colis des lignes
 *    totalisent bien ce que le fournisseur annonce et que chaque ligne tombe
 *    juste, l'arithmétique est saine et il ne reste qu'à arbitrer les
 *    catégories. Sur les deux packings réelles, il échoue une fois sur deux.
 *
 *  · l'ÉCART AVEC LA SAISIE — la packing dit-elle la même chose que ce qui a
 *    été saisi à la main sur l'arrivage ? Les totaux saisis ne sont jamais
 *    écrasés : on montre l'écart, l'humain tranche.
 */
export function PackingReviewToolbar({
    summary,
    progress,
    gap,
    containerMatches,
    expectedContainerRef,
    modelStats,
    filter,
    onFilterChange,
    labelQuery,
    onLabelQueryChange,
    sort,
    onSortChange,
    onValidate,
    validating,
}: PackingReviewToolbarProps) {
    const settled = progress.reviewedGroups + progress.dictionaryGroups + progress.modelGroups
    const percent = progress.groupCount === 0 ? 0 : Math.round((settled / progress.groupCount) * 100)
    const blockedReason =
        progress.unmatchedLines > 0
            ? `${progress.unmatchedLines} ligne${progress.unmatchedLines > 1 ? "s" : ""} sans catégorie`
            : progress.groupCount === 0
              ? "cette packing list n'a aucune ligne"
              : null

    // `null` = le fichier n'annonce aucun total et aucune ligne ne cloche : il
    // n'y a rien à confronter, on ne peut donc pas le déclarer sain.
    const integrity = packingFileIntegrity(summary)
    const FileIcon = integrity === null ? FileQuestion : integrity.sound ? FileCheck2 : FileWarning

    return (
        <div className="flex flex-col gap-3">
            {/* ── Intégrité du fichier ─────────────────────────────────────── */}
            <div
                className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-xs",
                    integrity === null
                        ? "border-border bg-muted/40 text-muted-foreground"
                        : integrity.sound
                          ? "border-success/20 bg-success-light text-success"
                          : "border-warning/20 bg-warning-light text-warning",
                )}
            >
                <FileIcon size={14} className="shrink-0" aria-hidden />
                {integrity === null ? (
                    <span>
                        Le fichier n'annonce aucun total de colis : impossible de le contrôler contre
                        lui-même. Les{" "}
                        <span className="font-semibold tabular-nums">
                            {formatPackages(summary.total_packages)}
                        </span>{" "}
                        proviennent des seules lignes lues.
                    </span>
                ) : integrity.sound ? (
                    <span>
                        Le fichier se recoupe :{" "}
                        <span className="font-semibold tabular-nums">
                            {formatPackages(summary.total_packages)}
                        </span>{" "}
                        conformes au total qu'il annonce, et {summary.line_count} ligne
                        {summary.line_count > 1 ? "s" : ""} cohérente
                        {summary.line_count > 1 ? "s" : ""}.
                    </span>
                ) : (
                    <span className="min-w-0">
                        {integrity.packageCountGap !== 0 && (
                            <>
                                <span className="font-semibold tabular-nums">
                                    {formatPackages(summary.total_packages)}
                                </span>{" "}
                                sur les lignes contre{" "}
                                <span className="font-semibold tabular-nums">
                                    {summary.declared_package_count}
                                </span>{" "}
                                annoncés par le fichier ({formatSigned(integrity.packageCountGap)}).{" "}
                            </>
                        )}
                        {integrity.rowsFailingMath > 0 && (
                            <>
                                {integrity.rowsFailingMath} ligne
                                {integrity.rowsFailingMath > 1 ? "s" : ""} dont le calcul ne tombe pas juste —
                                dépliez les libellés concernés pour les voir.
                            </>
                        )}
                    </span>
                )}
            </div>

            {containerMatches === false && (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                    <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
                    <span>
                        Le fichier s'intitule «&nbsp;{summary.container_label}&nbsp;»
                        {expectedContainerRef
                            ? <>, qui ne mentionne pas le conteneur&nbsp;<span className="font-mono">{expectedContainerRef}</span> de cet arrivage</>
                            : <>, qui ne correspond pas au conteneur de cet arrivage</>}
                        . Vérifiez que la packing list est attachée au bon arrivage avant de la valider.
                    </span>
                </div>
            )}

            {/* ── Avancement et totaux ─────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                    <p className="text-xs text-muted-foreground">
                        {/* `key` remonte le compteur à chaque changement de valeur,
                            ce qui rejoue l'animation CSS : le chiffre « tique »
                            quand une décision est prise et se lit comme un accusé
                            de réception. L'animation est portée par l'élément qui
                            contient DÉJÀ tout le texte — y interposer un span
                            scinderait « 1 / 2 » en plusieurs éléments, que ni un
                            lecteur d'écran ni une requête par texte ne recollent. */}
                        <span
                            key={settled}
                            className="inline-block animate-in fade-in zoom-in-95 duration-fast ease-overshoot font-semibold tabular-nums text-foreground motion-reduce:animate-none"
                        >
                            {settled} / {progress.groupCount}
                        </span>{" "}
                        libellés classés
                        {progress.dictionaryGroups > 0 && (
                            <span className="tabular-nums">
                                {" "}
                                — dont {progress.dictionaryGroups} reconnu
                                {progress.dictionaryGroups > 1 ? "s" : ""} automatiquement
                            </span>
                        )}
                        {progress.modelGroups > 0 && (
                            <span className="tabular-nums">
                                {progress.dictionaryGroups > 0 ? "," : " — dont"} {progress.modelGroups} classé
                                {progress.modelGroups > 1 ? "s" : ""} par le modèle
                            </span>
                        )}
                    </p>
                    <Progress value={percent} className="h-1.5" aria-label="Progression de la vérification" />
                    <PackingLearningNote
                        stats={modelStats}
                        firstContainer={progress.dictionaryGroups === 0 && progress.modelGroups === 0}
                    />
                </div>

                {/* Sous 640 px les trois totaux se rangent en colonnes égales
                    plutôt que de déborder en bout de ligne. */}
                <div className="grid w-full grid-cols-3 gap-3 text-xs tabular-nums sm:flex sm:w-auto sm:gap-4">
                    <div className="flex flex-col">
                        <span className="text-2xs uppercase tracking-wider text-muted-foreground">Colis</span>
                        <span className="font-semibold text-foreground">{summary.total_packages}</span>
                        {gap?.packages != null && gap.packages !== 0 && (
                            <span className={cn(gap.diverges ? "text-warning" : "text-muted-foreground")}>
                                {formatSigned(gap.packages)} vs saisi
                            </span>
                        )}
                    </div>
                    {summary.total_pieces > 0 && (
                        <div className="flex flex-col">
                            <span className="text-2xs uppercase tracking-wider text-muted-foreground">Pièces</span>
                            <span className="font-semibold text-foreground">
                                {formatQty(summary.total_pieces)}
                            </span>
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="text-2xs uppercase tracking-wider text-muted-foreground">Poids</span>
                        <span className="font-semibold text-foreground">
                            {/* 0 ne veut pas dire « zéro kilo » : sur un document
                                en pièces, le poids n'est simplement pas donné. */}
                            {summary.total_weight_kg > 0 ? formatKg(summary.total_weight_kg) : "non renseigné"}
                        </span>
                        {gap?.weightKg != null && gap.weightKg !== 0 && (
                            <span className={cn(gap.diverges ? "text-warning" : "text-muted-foreground")}>
                                {formatSigned(gap.weightKg)} kg vs saisi
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative min-w-40 flex-1">
                    <Search
                        size={12}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        value={labelQuery}
                        onChange={(event) => onLabelQueryChange(event.target.value)}
                        placeholder="Chercher un libellé…"
                        aria-label="Chercher un libellé"
                        className="h-8 pl-7 text-xs"
                    />
                </div>

                <div
                    role="radiogroup"
                    aria-label="Ordre des libellés"
                    className="flex gap-1 rounded-lg bg-muted p-0.5"
                >
                    {SORTS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={sort === option.value}
                            onClick={() => onSortChange(option.value)}
                            className={cn(
                                "flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-fast sm:flex-none",
                                sort === option.value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div
                    role="radiogroup"
                    aria-label="Filtrer les libellés"
                    className="flex gap-1 rounded-lg bg-muted p-0.5"
                >
                    {FILTERS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={filter === option.value}
                            onClick={() => onFilterChange(option.value)}
                            className={cn(
                                "flex-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-fast sm:flex-none",
                                filter === option.value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {onValidate && (
                    <TooltipProvider delayDuration={200}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {/* Le span porte l'infobulle : un bouton
                                    désactivé ne reçoit aucun événement. */}
                                <span tabIndex={blockedReason ? 0 : -1} className="block">
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="w-full gap-1.5 sm:w-auto"
                                        disabled={!progress.canValidate}
                                        loading={validating}
                                        onClick={onValidate}
                                    >
                                        <CheckCheck size={14} aria-hidden />
                                        Valider la packing list
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {blockedReason && (
                                <TooltipContent side="bottom">
                                    Impossible de valider : {blockedReason}.
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )
}
