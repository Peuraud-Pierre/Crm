import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import * as magasinService from "@/features/magasins/services/magasinService"
import { magasinErrorMessage } from "@/features/magasins/utils/crudErrors"
import type { Magasin, MagasinFormInput, MagasinPatch } from "@/features/magasins/types/magasin.types"

const ENTITY = "du magasin"

/**
 * Liste des magasins et ses mutations. Chaque mutation renvoie `true` en cas
 * de succès, pour que la sheet appelante sache se fermer ; l'erreur est
 * annoncée par un toast.
 */
export function useMagasins() {
    const [magasins, setMagasins] = useState<Magasin[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const requestRef = useRef(0)

    const refetch = useCallback(async () => {
        const request = ++requestRef.current
        try {
            const rows = await magasinService.fetchMagasins()
            if (request !== requestRef.current) return
            setMagasins(rows)
            setError(null)
        } catch (err) {
            if (request !== requestRef.current) return
            console.error(err)
            setError("Impossible de charger les magasins.")
        } finally {
            if (request === requestRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        void refetch()
    }, [refetch])

    const create = useCallback(
        async (input: MagasinFormInput): Promise<Magasin | null> => {
            try {
                const created = await magasinService.insertMagasin(input)
                toast.success(`Magasin « ${created.nom} » créé`)
                await refetch()
                return created
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage(ENTITY, "create", err))
                return null
            }
        },
        [refetch],
    )

    const update = useCallback(
        async (id: string, input: MagasinPatch, { silent = false }: { silent?: boolean } = {}): Promise<boolean> => {
            try {
                await magasinService.patchMagasin(id, input)
                // Silencieux pour les réglages en continu (calage du fond,
                // consignes) : un toast par ajustement serait du bruit.
                if (!silent) toast.success("Magasin enregistré")
                await refetch()
                return true
            } catch (err) {
                console.error(err)
                toast.error(magasinErrorMessage(ENTITY, "update", err))
                return false
            }
        },
        [refetch],
    )

    const remove = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                await magasinService.removeMagasin(id)
                toast.success("Magasin supprimé")
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

    return { magasins, loading, error, refetch, create, update, remove }
}
