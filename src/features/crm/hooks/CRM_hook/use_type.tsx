import { useCallback, useEffect, useMemo, useState } from "react"
import { createType, fetchTypes, deleteType } from "@/features/crm/services/typeService"

export type { Type_CRM } from "@/features/crm/types"
import type { Type_CRM } from "@/features/crm/types"

export function useType() {
    const [Type, setType] = useState<Type_CRM[]>([])

    // create_product reçoit maintenant un produit en paramètre
    const create_Type = useCallback(async (Type: Type_CRM) => {
        try {
            const id = await createType(Type)

            // Mise à jour optimiste du state local (plus de Realtime sur cette
            // table) pour que la liste reflète immédiatement la création.
            setType((prev) =>
                prev.some((t) => t.id === id)
                    ? prev
                    : [...prev, { id, name: Type.name }]
            )
            return id
        } catch (error) {
            console.error(error, "❌ erreur lors de la création du produit")
        }
    }, [])
    const fetch_Type = useCallback(async (): Promise<
        Type_CRM[] | undefined
    > => {
        try {
            const data = await fetchTypes()
            setType(data)
            return data
        } catch (error) {
            console.error(
                error,
                "❌ erreur lors de la récupération des produits"
            )
            return undefined
        }
    }, [])
    const delete_Type = useCallback(async (id: string) => {
        try {
            await deleteType(id)

            // Met à jour le state local après suppression
            setType((prev) => prev.filter((prod) => prod.id !== id))
        } catch (error) {
            console.error(error, "❌ erreur lors de la suppression du produit")
        }
    }, [])
    useEffect(() => {
        // Pas de Realtime : `Type_product_CRM` est une config quasi statique. Les
        // mutations locales (create/delete) gardent la liste à jour ; fetch
        // initial au montage + `fetch_Type` exposé pour actualiser.
        fetch_Type()
    }, [])

    const values = useMemo(() => {
        return { Type, create_Type, fetch_Type, delete_Type }
    }, [Type, create_Type, fetch_Type, delete_Type])

    return values
}
