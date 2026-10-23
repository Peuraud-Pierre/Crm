import { createContext, use, type ReactNode } from "react"

// Contexte hérité de l'ancienne feature `gestion` (renommée `stock`). Ses seuls
// consommateurs sont du code non routé (feature sorters, imports commentés dans
// AuthRoutes). On garde un contexte minimal autonome pour que ce code reste
// compilable, sans réintroduire de dépendance vers un module supprimé, ni de
// dépendance shared → feature (le type balle est décrit structurellement ici).
interface GestionBalle {
    id: string
    category?: string | null
    receiption_date?: string | null
    fournisseur?: { name?: string | null } | null
    unit?: string | null
    weight?: number | null
    piece?: number | null
    assigned_to?: { full_name?: string | null; user_id?: string | null } | null
}

interface GestionContextValue {
    balle: GestionBalle[]
    fetch_balle: () => void | Promise<void>
    update_balle: (balle: GestionBalle) => void | Promise<void>
}

const GestionContext = createContext<GestionContextValue | null>(null)

export function GestionsProvider({ children }: { children: ReactNode }) {
    const value: GestionContextValue = {
        balle: [],
        fetch_balle: () => {},
        update_balle: () => {},
    }
    return <GestionContext value={value}>{children}</GestionContext>
}

export function useGestionsContext(): GestionContextValue {
    const ctx = use(GestionContext)
    if (!ctx) {
        throw new Error(
            "useGestionsContext doit être utilisé dans un GestionsProvider"
        )
    }
    return ctx
}
