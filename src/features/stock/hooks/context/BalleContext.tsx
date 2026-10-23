import {
    createContext,
    useCallback,
    use,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import {
    type Balle,
    type BalleFormInput,
    type BalleFiltersState,
    DEFAULT_BALLE_FILTERS,
} from "@/features/stock/types/stock.types"
import { useBalle } from "../data/useBalle"
import { useOptimisticCrud } from "@/shared/hooks/useOptimisticCrud"
import { toast } from "sonner"
import { useStockUIContext } from "./StockUIContext"

interface BalleContextType {
    // data
    balles: Balle[] | undefined
    filteredBalles: Balle[]
    fetchBalles: () => Promise<void>
    fetchSingleBalle: (id: string) => Promise<Balle | undefined>
    createBalle: (data: BalleFormInput) => Promise<Balle | null>
    createMultipleBalles: (data: BalleFormInput[]) => Promise<Balle[] | null>
    /** Vrai si l'écriture a abouti (l'échec est déjà signalé par un toast). */
    updateBalle: (id: string, data: Partial<Balle>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    deleteBalle: (id: string) => Promise<boolean>

    // filters
    balleFilters: BalleFiltersState
    setBalleFilters: (filters: Partial<BalleFiltersState>) => void
    resetBalleFilters: () => void

    // creation sheet
    balleCreationSheetOpen: boolean
    setBalleCreationSheetOpen: (open: boolean) => void

    // detail sheet
    selectedBalle: Balle | null
    setSelectedBalle: (balle: Balle | null) => void
    balleDetailSheetOpen: boolean
    setBalleDetailSheetOpen: (open: boolean) => void

    // form
    balleCreationFormData: Partial<BalleFormInput> | undefined
    setBalleCreationFormData: (data: Partial<BalleFormInput>) => void
}

const BalleContext = createContext<BalleContextType | undefined>(undefined)

export function BalleProvider({ children }: { children: ReactNode }) {
    const { searchInput } = useStockUIContext()

    // setBalleFiltersState : setter brut, exposé publiquement via l'alias setBalleFilters.
    // eslint-disable-next-line react-naming-convention/use-state
    const [balleFilters, setBalleFiltersState] = useState<BalleFiltersState>(DEFAULT_BALLE_FILTERS)
    const [balleCreationSheetOpen, setBalleCreationSheetOpen] = useState(false)
    const [selectedBalle, setSelectedBalle] = useState<Balle | null>(null)
    const [balleDetailSheetOpen, setBalleDetailSheetOpen] = useState(false)
    const [balleCreationFormData, setBalleCreationFormData] = useState<Partial<BalleFormInput>>()

    const setBalleFilters = useCallback((filters: Partial<BalleFiltersState>) => {
        setBalleFiltersState((prev) => ({ ...prev, ...filters }))
    }, [])

    const resetBalleFilters = useCallback(() => {
        setBalleFiltersState(DEFAULT_BALLE_FILTERS)
    }, [])

    const {
        balles: serverBalles,
        fetchBalles,
        fetchSingleBalle,
        createBalle: apiCreateBalle,
        createMultipleBalles,
        updateBalle: apiUpdateBalle,
        deleteBalle: apiDeleteBalle,
    } = useBalle()

    const balleApi = useMemo(
        () => ({
            create: apiCreateBalle,
            update: apiUpdateBalle,
            delete: apiDeleteBalle,
            refetch: fetchBalles,
        }),
        [apiCreateBalle, apiUpdateBalle, apiDeleteBalle, fetchBalles]
    )

    const onBalleError = useCallback(
        (action: string) =>
            toast.error(`Erreur lors de l'action sur la balle : ${action}`),
        []
    )

    const {
        items: balles,
        create: createBalle,
        update: updateBalle,
        remove: deleteBalle,
    } = useOptimisticCrud<Balle, BalleFormInput>(serverBalles, balleApi, onBalleError)

    const filteredBalles = useMemo(() => {
        if (!balles) return []
        let result = [...balles]

        if (balleFilters.status !== "all")
            result = result.filter((b) => b.status === balleFilters.status)
        if (balleFilters.type !== "all")
            result = result.filter((b) => b.type === balleFilters.type)
        if (balleFilters.location !== "all")
            result = result.filter((b) => b.location === balleFilters.location)
        if (balleFilters.category_id !== "all")
            result = result.filter((b) => b.category_id === balleFilters.category_id)
        if (balleFilters.fournisseur_id !== "all")
            result = result.filter((b) => b.fournisseur_id === balleFilters.fournisseur_id)
        if (balleFilters.dateFrom)
            result = result.filter((b) => b.import_date && b.import_date >= balleFilters.dateFrom)
        if (balleFilters.dateTo)
            result = result.filter((b) => b.import_date && b.import_date <= balleFilters.dateTo)
        if (searchInput.trim()) {
            const s = searchInput.toLowerCase()
            result = result.filter(
                (b) =>
                    b.bin?.toLowerCase().includes(s) ||
                    b.fournisseur?.name?.toLowerCase().includes(s) ||
                    b.category?.name?.toLowerCase().includes(s)
            )
        }

        return result
    }, [balles, balleFilters, searchInput])

    const value = useMemo(
        () => ({
            balles,
            filteredBalles,
            fetchBalles,
            fetchSingleBalle,
            createBalle,
            createMultipleBalles,
            updateBalle,
            deleteBalle,
            balleFilters,
            setBalleFilters,
            resetBalleFilters,
            balleCreationSheetOpen,
            setBalleCreationSheetOpen,
            selectedBalle,
            setSelectedBalle,
            balleDetailSheetOpen,
            setBalleDetailSheetOpen,
            balleCreationFormData,
            setBalleCreationFormData,
        }),
        [
            balles,
            filteredBalles,
            fetchBalles,
            fetchSingleBalle,
            createBalle,
            createMultipleBalles,
            updateBalle,
            deleteBalle,
            balleFilters,
            setBalleFilters,
            resetBalleFilters,
            balleCreationSheetOpen,
            selectedBalle,
            balleDetailSheetOpen,
            balleCreationFormData,
        ]
    )

    return <BalleContext value={value}>{children}</BalleContext>
}

export function useBalleContext() {
    const context = use(BalleContext)
    if (!context) {
        throw new Error("useBalleContext must be used within a BalleProvider")
    }
    return context
}
