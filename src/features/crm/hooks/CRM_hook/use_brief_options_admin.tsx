import { useCallback, useEffect, useMemo, useState } from "react"
import {
    createBriefOption,
    deleteBriefOption,
    listBriefOptions,
    updateBriefOption,
} from "@/features/crm/services/briefOptionsService"
import type { BriefCategorie, BriefOption } from "@/features/crm/types"

/**
 * Hook CRUD pour l'administration des listes de valeurs du brief CRM.
 * Séparé de use_brief_options.tsx (lecture seule, consommé par
 * colonneBrief.tsx) pour ne pas embarquer le code de mutation dans le
 * bundle de la fiche client.
 *
 * Renommer une valeur (`rename_BriefOption`) ne met à jour que le
 * référentiel : les briefs déjà enregistrés référencent une valeur par sa
 * chaîne exacte dans le JSON `client_crm.brief` — un ancien brief gardera
 * l'ancien libellé tant qu'il n'est pas resauvegardé. Accepté sciemment
 * pour permettre de corriger une valeur mal orthographiée sans perdre son
 * historique de sélection.
 */
export function useBriefOptionsAdmin() {
    const [options, setOptions] = useState<BriefOption[]>([])
    const [loading, setLoading] = useState(true)

    const fetch_BriefOptions = useCallback(async () => {
        setLoading(true)
        try {
            const data = await listBriefOptions()
            setOptions(data)
        } catch (error) {
            console.error(
                error,
                "❌ erreur lors de la récupération des options de brief"
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetch_BriefOptions()
    }, [fetch_BriefOptions])

    const create_BriefOption = useCallback(
        async (categorie: BriefCategorie, value: string) => {
            const trimmed = value.trim()
            if (!trimmed) return
            try {
                const id = await createBriefOption(categorie, trimmed)
                setOptions((prev) => [
                    ...prev,
                    { id, categorie, value: trimmed, active: true },
                ])
            } catch (error) {
                console.error(
                    error,
                    "❌ erreur lors de la création d'une option de brief"
                )
            }
        },
        []
    )

    const toggle_BriefOptionActive = useCallback(
        async (id: number, active: boolean) => {
            setOptions((prev) =>
                prev.map((o) => (o.id === id ? { ...o, active } : o))
            )
            try {
                await updateBriefOption(id, { active })
            } catch (error) {
                console.error(
                    error,
                    "❌ erreur lors de la mise à jour d'une option de brief"
                )
                fetch_BriefOptions()
            }
        },
        [fetch_BriefOptions]
    )

    const rename_BriefOption = useCallback(
        async (id: number, value: string) => {
            const trimmed = value.trim()
            if (!trimmed) return
            setOptions((prev) =>
                prev.map((o) => (o.id === id ? { ...o, value: trimmed } : o))
            )
            try {
                await updateBriefOption(id, { value: trimmed })
            } catch (error) {
                console.error(
                    error,
                    "❌ erreur lors du renommage d'une option de brief"
                )
                fetch_BriefOptions()
            }
        },
        [fetch_BriefOptions]
    )

    const delete_BriefOption = useCallback(async (id: number) => {
        try {
            await deleteBriefOption(id)
            setOptions((prev) => prev.filter((o) => o.id !== id))
        } catch (error) {
            console.error(
                error,
                "❌ erreur lors de la suppression d'une option de brief"
            )
        }
    }, [])

    const byCategorie = useMemo(() => {
        const grouped = {} as Record<BriefCategorie, BriefOption[]>
        for (const option of options) {
            ;(grouped[option.categorie] ??= []).push(option)
        }
        return grouped
    }, [options])

    return {
        options,
        byCategorie,
        loading,
        refetch: fetch_BriefOptions,
        create_BriefOption,
        toggle_BriefOptionActive,
        rename_BriefOption,
        delete_BriefOption,
    }
}
