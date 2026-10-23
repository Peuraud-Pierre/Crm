import { useEffect, useState } from "react"
import { fetchSuppliers } from "@/features/sorters/services/sortersService"

export function useSuppliers() {
    const [suppliersId, setSuppliersId] = useState<string>("")
    const [suppliers, setSuppliers] = useState<
        { id: string; name: string | null }[]
    >([])

    useEffect(() => {
        fetchSuppliers(suppliersId).then(setSuppliers)
    }, [suppliersId])

    return { suppliers, setSuppliersId }
}
