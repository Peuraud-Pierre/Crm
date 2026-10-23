import { BookCheck, DatabaseZap, Target } from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { MISTAKES_WINDOW_DAYS } from "@/features/packing-admin/constants"
import type {
    PackingDictionaryConflict,
    PackingModelMiss,
} from "@/features/packing-admin/types"
import { DictionaryConflicts } from "./DictionaryConflicts"
import { MissesList } from "./MissesList"

interface MissesTabProps {
    misses: {
        misses: PackingModelMiss[]
        conflicts: PackingDictionaryConflict[]
        loading: boolean
        error: Error | null
        tableMissing: boolean
    }
}

/**
 * Onglet « Écarts » — pourquoi la précision stagne, et ce qui se répétera si on
 * ne fait rien.
 *
 * Deux panneaux, dans cet ordre, parce qu'ils ne coûtent pas la même chose :
 *
 *  1. **Les correspondances contredites d'abord.** Le tableau ne reconnaît que
 *     des libellés IDENTIQUES : une entrée fausse se réapplique à l'identique sur
 *     tous les conteneurs suivants et ne se corrige jamais d'elle-même. C'est la
 *     dette qui grossit.
 *  2. **Les écarts du modèle ensuite.** Une proposition corrigée est du travail
 *     normal — c'est même ce qui l'entraîne. Ce qui mérite un regard, c'est la
 *     part qu'il avait classée SEUL.
 */
export function MissesTab({ misses }: MissesTabProps) {
    if (misses.tableMissing) {
        return (
            <EmptyState
                size="md"
                icon={DatabaseZap}
                title="Journal des décisions indisponible"
                description="La table packing_label_feedback n'existe pas encore : la migration 20260918100000 n'est pas appliquée. Cet onglet se remplira dès qu'elle le sera."
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    if (misses.loading) return <SkeletonList />

    if (misses.error) {
        return (
            <EmptyState
                size="sm"
                icon={Target}
                title="Écarts illisibles"
                description={misses.error.message}
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    const nothing = misses.conflicts.length === 0 && misses.misses.length === 0

    if (nothing) {
        return (
            <EmptyState
                size="md"
                icon={BookCheck}
                title="Aucun écart sur la période"
                description={`Sur les ${MISTAKES_WINDOW_DAYS} derniers jours, aucune proposition du modèle n'a été contredite et aucune correspondance apprise n'est en désaccord avec une décision plus récente.`}
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            <Card className="flex flex-col gap-3 p-4 sm:p-6">
                <DictionaryConflicts conflicts={misses.conflicts} />
            </Card>
            <Card className="flex flex-col gap-3 p-4 sm:p-6">
                <MissesList misses={misses.misses} />
            </Card>
        </div>
    )
}
