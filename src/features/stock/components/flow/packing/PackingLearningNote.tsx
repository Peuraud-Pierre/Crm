import { Bot, Sprout } from "lucide-react"
import type { PackingModelStats } from "@/features/stock/types/packing-list.types"
import { learningStatusLine } from "@/features/stock/utils/packingLearning"

interface PackingLearningNoteProps {
    /** `null` : aucun service configuré, ou injoignable. */
    stats: PackingModelStats | null
    /** Aucun libellé reconnu ni classé seul : personne n'a encore rien appris. */
    firstContainer: boolean
}

/**
 * Ce que ce travail rapporte, écrit là où il est fourni.
 *
 * Les mêmes nombres existaient déjà, mais seulement dans Paramètres →
 * Correspondances — c'est-à-dire nulle part pour qui est en train de trancher
 * 140 libellés. Deux faits, et rien de plus :
 *
 *  · au premier conteneur d'un vocabulaire, RIEN n'est reconnu, et l'écran ne
 *    le disait pas : 140 cartes nues se lisent comme une corvée arbitraire tant
 *    qu'on ignore qu'elles ne reviendront pas ;
 *  · où en est le classement automatique, et ce qu'il lui manque pour
 *    s'activer.
 *
 * Service injoignable : on n'affiche rien. Au milieu du travail, ce serait un
 * bandeau d'erreur pour quelque chose que l'utilisateur ne peut pas réparer et
 * qui ne le bloque pas — l'indisponibilité a sa place dans les paramètres, pas
 * ici.
 *
 * Sobriété volontaire : chaque phrase est un fait vérifiable, jamais un
 * encouragement. L'accusé de réception d'un geste reste la carte qui quitte la
 * strate (voir `PackingReviewPanel`).
 */
export function PackingLearningNote({ stats, firstContainer }: PackingLearningNoteProps) {
    const learning = stats === null ? null : learningStatusLine(stats)
    if (!firstContainer && learning === null) return null

    return (
        <div className="flex flex-col gap-1">
            {firstContainer && (
                <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
                    <Sprout size={12} className="mt-px shrink-0 text-success" aria-hidden />
                    <span>
                        Aucun libellé n'est encore reconnu : c'est le premier conteneur de ce
                        vocabulaire. Ceux que vous classez ici seront reconnus d'office sur les
                        suivants.
                    </span>
                </p>
            )}
            {learning && (
                <p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
                    <Bot
                        size={12}
                        className={learning.active ? "mt-px shrink-0 text-primary" : "mt-px shrink-0"}
                        aria-hidden
                    />
                    <span>{learning.text}</span>
                </p>
            )}
        </div>
    )
}
