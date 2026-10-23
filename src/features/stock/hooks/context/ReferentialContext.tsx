import {
    createContext,
    useCallback,
    use,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import { useFournisseur } from "../data/useFournisseur"
import { useCategorie } from "../data/useCategorie"
import { useOptimisticCrud } from "@/shared/hooks/useOptimisticCrud"
import { toast } from "sonner"
import type { Fournisseur, BalleCategory } from "@/features/stock/types/stock.types"
import { referentialErrorMessage } from "@/features/stock/utils/crudErrors"

interface ReferentialContextType {
    // ─── Fournisseurs ────────────────────────────────────────────────────────────
    fournisseurs: Fournisseur[]
    fetchFournisseurs: () => Promise<void>
    fetchSingleFournisseur: (id: string) => Promise<Fournisseur | null>
    createFournisseur: (data: Omit<Fournisseur, "id" | "created_at">) => Promise<Fournisseur | null>
    /** Vrai si l'écriture a abouti (l'échec est déjà signalé par un toast). */
    updateFournisseur: (id: string, data: Partial<Omit<Fournisseur, "id" | "created_at">>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    deleteFournisseur: (id: string) => Promise<boolean>

    fournisseurCreationSheetOpen: boolean
    setFournisseurCreationSheetOpen: (open: boolean) => void

    // ─── Categories ──────────────────────────────────────────────────────────────
    categories: BalleCategory[]
    fetchCategories: () => Promise<void>
    fetchSingleCategory: (id: string) => Promise<BalleCategory | null>
    createCategory: (data: Omit<BalleCategory, "id">) => Promise<BalleCategory | null>
    /** Vrai si l'écriture a abouti (l'échec est déjà signalé par un toast). */
    updateCategory: (id: string, data: Partial<Omit<BalleCategory, "id">>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    deleteCategory: (id: string) => Promise<boolean>

    categoryCreationSheetOpen: boolean
    setCategoryCreationSheetOpen: (open: boolean) => void
}

const ReferentialContext = createContext<ReferentialContextType | undefined>(undefined)

export function ReferentialProvider({ children }: { children: ReactNode }) {
    // ─── Sheet states ─────────────────────────────────────────────────────────────
    const [fournisseurCreationSheetOpen, setFournisseurCreationSheetOpen] = useState(false)
    const [categoryCreationSheetOpen, setCategoryCreationSheetOpen]       = useState(false)

    // ─── Fournisseurs ─────────────────────────────────────────────────────────────
    const {
        fournisseurs: serverFournisseurs,
        fetchFournisseurs,
        fetchSingleFournisseur,
        createFournisseur: apiCreateFournisseur,
        updateFournisseur: apiUpdateFournisseur,
        deleteFournisseur: apiDeleteFournisseur,
    } = useFournisseur()

    const fournisseurApi = useMemo(
        () => ({
            create: apiCreateFournisseur,
            update: apiUpdateFournisseur,
            delete: apiDeleteFournisseur,
            refetch: fetchFournisseurs,
        }),
        [apiCreateFournisseur, apiUpdateFournisseur, apiDeleteFournisseur, fetchFournisseurs]
    )

    const onFournisseurError = useCallback(
        (action: string, error: unknown) =>
            toast.error(referentialErrorMessage("du fournisseur", action, error)),
        []
    )

    const {
        items: fournisseurs,
        create: createFournisseur,
        update: updateFournisseur,
        remove: deleteFournisseur,
    } = useOptimisticCrud<Fournisseur, Omit<Fournisseur, "id" | "created_at">>(
        serverFournisseurs,
        fournisseurApi,
        onFournisseurError
    )

    // ─── Categories ───────────────────────────────────────────────────────────────
    const {
        categories: serverCategories,
        fetchCategories,
        fetchSingleCategory,
        createCategory: apiCreateCategory,
        updateCategory: apiUpdateCategory,
        deleteCategory: apiDeleteCategory,
    } = useCategorie()

    const categoryApi = useMemo(
        () => ({
            create: apiCreateCategory,
            update: apiUpdateCategory,
            delete: apiDeleteCategory,
            refetch: fetchCategories,
        }),
        [apiCreateCategory, apiUpdateCategory, apiDeleteCategory, fetchCategories]
    )

    const onCategoryError = useCallback(
        (action: string, error: unknown) =>
            toast.error(referentialErrorMessage("de la catégorie", action, error)),
        []
    )

    const {
        items: categories,
        create: createCategory,
        update: updateCategory,
        remove: deleteCategory,
    } = useOptimisticCrud<BalleCategory, Omit<BalleCategory, "id">>(
        serverCategories,
        categoryApi,
        onCategoryError
    )

    // ─── Value ────────────────────────────────────────────────────────────────────
    const value = useMemo(
        () => ({
            fournisseurs,
            fetchFournisseurs,
            fetchSingleFournisseur,
            createFournisseur,
            updateFournisseur,
            deleteFournisseur,
            fournisseurCreationSheetOpen,
            setFournisseurCreationSheetOpen,
            categories,
            fetchCategories,
            fetchSingleCategory,
            createCategory,
            updateCategory,
            deleteCategory,
            categoryCreationSheetOpen,
            setCategoryCreationSheetOpen,
        }),
        [
            fournisseurs,
            fetchFournisseurs,
            fetchSingleFournisseur,
            createFournisseur,
            updateFournisseur,
            deleteFournisseur,
            fournisseurCreationSheetOpen,
            categories,
            fetchCategories,
            fetchSingleCategory,
            createCategory,
            updateCategory,
            deleteCategory,
            categoryCreationSheetOpen,
        ]
    )

    return (
        <ReferentialContext value={value}>
            {children}
        </ReferentialContext>
    )
}

export function useReferentialContext() {
    const context = use(ReferentialContext)
    if (!context) {
        throw new Error("useReferentialContext must be used within a ReferentialProvider")
    }
    return context
}