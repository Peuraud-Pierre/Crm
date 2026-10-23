import { createContext, use, useMemo, type ReactNode } from "react"
import { useArrivageManuel } from "../data/useArrivageManuel"
import { useReferentialContext } from "./ReferentialContext"
import type {
    ArrivageManuelRow,
    ArrivageManuelCreateInput,
    ArrivageManuelUpdateInput,
} from "@/features/stock/types/arrivage-manuel.types"

interface ArrivageManuelContextType {
    rows: ArrivageManuelRow[] | undefined
    fetchAll: () => Promise<void>
    create: (data: ArrivageManuelCreateInput) => Promise<ArrivageManuelRow | null>
    update: (id: string, patch: ArrivageManuelUpdateInput) => Promise<void>
    remove: (id: string) => Promise<void>
}

const ArrivageManuelContext = createContext<ArrivageManuelContextType | undefined>(undefined)

export function ArrivageManuelProvider({ children }: { children: ReactNode }) {
    const { rows: serverRows, fetchAll, create, update, remove } = useArrivageManuel()
    const { fournisseurs } = useReferentialContext()

    const rows = useMemo(() => {
        if (!serverRows) return serverRows
        const byId = new Map(fournisseurs.map((f) => [f.id, f]))
        return serverRows.map((row) =>
            row.fournisseur_id && byId.has(row.fournisseur_id)
                ? { ...row, fournisseur: byId.get(row.fournisseur_id) }
                : row
        )
    }, [serverRows, fournisseurs])

    const value = useMemo(
        () => ({ rows, fetchAll, create, update, remove }),
        [rows, fetchAll, create, update, remove]
    )

    return (
        <ArrivageManuelContext value={value}>
            {children} 
        </ArrivageManuelContext>
    )
}

export function useArrivageManuelContext() {
    const ctx = use(ArrivageManuelContext)
    if (!ctx) throw new Error("useArrivageManuelContext must be used within ArrivageManuelProvider")
    return ctx
}
