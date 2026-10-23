import { useCallback, useEffect, useMemo, useState } from "react"
import { fetchFournisseurs } from "@/features/crm/services/fournisseurService"

export type { Fournisseur } from "@/features/crm/types"
import type { Fournisseur } from "@/features/crm/types"

export function UseFournisseur() {
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])

    const fetch_Fournisseur = useCallback(async (): Promise<
        Fournisseur[] | undefined
    > => {
        try {
            const formattedData = await fetchFournisseurs()
            setFournisseurs(formattedData)
            return formattedData
        } catch (error) {
            console.error(
                "❌ erreur lors de la récupération des fournisseurs:",
                error
            )
            return undefined
        }
    }, [])

    useEffect(() => {
        fetch_Fournisseur()
    }, [fetch_Fournisseur])

    const values = useMemo(
        () => ({
            fournisseurs,
            fetch_Fournisseur,
        }),
        [fournisseurs, fetch_Fournisseur]
    )

    return values
}
