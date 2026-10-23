import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import * as etageService from "@/features/magasins/services/etageService"
import { magasinErrorMessage } from "@/features/magasins/utils/crudErrors"
import type { Etage, EtageFormInput, EtagePatch } from "@/features/magasins/types/magasin.types"

const ENTITY = "de l'étage"

/** Étages d'un magasin, du plus bas au plus haut, et leurs mutations. */
export function useEtages(magasinId: string) {
    const [etages, setEtages] = useState<Etage[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const requestRef = useRef(0)

    const refetch = useCallback(async () => {
        const request = ++requestRef.current
        try {
            const rows = await etageService.fetchEtages(magasinId)
            if (request !== requestRef.current) return
            setEtages(rows)
            setError(null)
        } catch (err) {
            if (request !== requestRef.current) return
            console.error(err)
            setError("Impossible de charger les étages.")
        } finally {
            if (request === requestRef.current) setLoading(false)
        }
    }, [magasinId])

    useEffect(() => {
        void refetch()
    }, [refetch])

    const create = useCallback(
        async (input: EtageFormInput): Promise<Etage | null> => {
            try {
                const created = await etageService.insertEtage(magasinId, input)
                toast.success(`Étage « ${created.nom} » ajouté`)
                await refetch()
                return created
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage(ENTITY, "create", err))
                return null
            }
        },
        [magasinId, refetch],
    )

    const update = useCallback(
        async (id: string, patch: EtagePatch, { silent = false }: { silent?: boolean } = {}): Promise<boolean> => {
            // Appliqué tout de suite : calage du plan et contour se règlent à
            // la souris, l'aller-retour serveur ne doit pas se voir.
            setEtages((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
            try {
                await etageService.patchEtage(id, patch)
                if (!silent) toast.success("Étage enregistré")
                return true
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage(ENTITY, "update", err))
                await refetch()
                return false
            }
        },
        [refetch],
    )

    const remove = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                await etageService.removeEtage(id)
                toast.success("Étage supprimé")
                await refetch()
                return true
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage(ENTITY, "delete", err))
                return false
            }
        },
        [refetch],
    )

    return { etages, loading, error, refetch, create, update, remove }
}

export type EtagesApi = ReturnType<typeof useEtages>
