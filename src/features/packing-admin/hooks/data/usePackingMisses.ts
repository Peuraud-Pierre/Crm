import { useCallback, useMemo } from "react"
import { MISTAKES_WINDOW_DAYS } from "@/features/packing-admin/constants"
import {
    attachAutoFlags,
    fetchDictionaryConflicts,
    fetchModelMisses,
    PackingTableMissingError,
} from "@/features/packing-admin/services/packingAdminService"
import { useAbortableResource } from "@/features/packing-admin/hooks/useAbortableResource"
import type {
    PackingDictionaryConflict,
    PackingImportRow,
    PackingModelMiss,
} from "@/features/packing-admin/types"

interface MissesPayload {
    misses: PackingModelMiss[]
    conflicts: PackingDictionaryConflict[]
}

/**
 * Là où le modèle se trompe, et les correspondances que l'humain contredit.
 *
 * Les deux lectures vont ensemble : une proposition corrigée une fois est du
 * bruit, la même correction devenue une entrée fausse du dictionnaire se répète
 * sur tous les conteneurs suivants. Les séparer en deux écrans ferait perdre ce
 * lien.
 *
 * `imports` sert à savoir quel seuil était en vigueur pour chaque packing, donc
 * si l'écart était un auto-classement — la seule catégorie d'erreur qui soit
 * passée sans regard humain.
 */
export function usePackingMisses(imports: PackingImportRow[]) {
    const load = useCallback(async (): Promise<MissesPayload> => {
        const [misses, conflicts] = await Promise.all([
            fetchModelMisses(MISTAKES_WINDOW_DAYS),
            fetchDictionaryConflicts(),
        ])
        return { misses, conflicts }
    }, [])

    const resource = useAbortableResource<MissesPayload>(load)

    const thresholdByPacking = useMemo(
        () => new Map(imports.map((row) => [row.id, row.threshold])),
        [imports],
    )

    const misses = useMemo(
        () => attachAutoFlags(resource.data?.misses ?? [], thresholdByPacking),
        [resource.data, thresholdByPacking],
    )

    return {
        misses,
        conflicts: resource.data?.conflicts ?? [],
        loading: resource.loading,
        error: resource.error,
        /**
         * La table n'existe pas encore (migration non appliquée). Ce n'est pas
         * une panne : l'écran doit le dire et ne rien afficher, plutôt que
         * remonter une erreur de base de données que personne ne peut corriger
         * depuis l'interface.
         */
        tableMissing: resource.error instanceof PackingTableMissingError,
        refetch: resource.refetch,
    }
}
