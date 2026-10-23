import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import * as dictionaryService from "@/features/stock/services/packingLabelDictionaryService"
import type { PackingLabelMapping } from "@/features/stock/types/packing-list.types"

/**
 * Tableau de correspondance libellé fournisseur → catégorie, pour l'écran des
 * paramètres.
 *
 * Il ne se CRÉE pas à la main : chaque entrée vient de la validation d'une
 * packing list, et c'est ce qui la rend digne d'auto-résoudre les imports
 * suivants sans relecture. Ce hook n'expose donc que la correction et l'oubli
 * — les deux gestes qui empêchent une erreur apprise une fois de se répéter
 * sur tous les conteneurs à venir.
 */
export function usePackingLabelDictionary() {
    const [mappings, setMappings] = useState<PackingLabelMapping[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        try {
            setMappings(await dictionaryService.fetchAllMappings())
        } catch (error) {
            toast.error("Erreur lors du chargement du tableau de correspondance")
            console.error("[usePackingLabelDictionary] fetchAll:", error)
            setMappings([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAll()
    }, [fetchAll])

    const updateCategory = useCallback(
        async (rawLabelKey: string, categoryId: string) => {
            // Optimiste : la liste est longue et la correction se fait à la
            // chaîne. Un échec recharge et le dit.
            setMappings((current) =>
                current.map((m) => (m.raw_label_key === rawLabelKey ? { ...m, category_id: categoryId } : m)),
            )
            try {
                await dictionaryService.updateMappingCategory(rawLabelKey, categoryId)
            } catch (error) {
                toast.error("Correspondance non enregistrée")
                console.error("[usePackingLabelDictionary] updateCategory:", error)
                await fetchAll()
            }
        },
        [fetchAll],
    )

    const remove = useCallback(
        async (rawLabelKey: string) => {
            try {
                await dictionaryService.deleteMapping(rawLabelKey)
                setMappings((current) => current.filter((m) => m.raw_label_key !== rawLabelKey))
            } catch (error) {
                toast.error("Correspondance non supprimée")
                console.error("[usePackingLabelDictionary] remove:", error)
                throw error
            }
        },
        [],
    )

    /** Nombre de libellés couverts : ce que le tableau épargne au prochain import. */
    const coverage = useMemo(() => mappings.length, [mappings])

    return { mappings, loading, coverage, fetchAll, updateCategory, remove }
}
