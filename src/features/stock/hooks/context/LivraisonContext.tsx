import {
    createContext,
    useCallback,
    use,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import {
    type Delivery,
    type DeliveryFormInput,
    type DeliveryFiltersState,
    DEFAULT_DELIVERY_FILTERS,
} from "@/features/stock/types/stock.types"
import { useDelivery } from "../data/useLivraison"
import { useOptimisticCrud } from "@/shared/hooks/useOptimisticCrud"
import { toast } from "sonner"
import { useStockUIContext } from "./StockUIContext"

interface DeliveryContextType {
    // data
    deliveries: Delivery[] | undefined
    filteredDeliveries: Delivery[]
    fetchDeliveries: () => Promise<void>
    fetchSingleDelivery: (id: string) => Promise<Delivery | undefined>
    fetchDeliveryByDIN: (din: string) => Promise<Delivery | null>
    createDelivery: (data: DeliveryFormInput) => Promise<Delivery | null>
    /** Vrai si l'écriture a abouti (l'échec est déjà signalé par un toast). */
    updateDelivery: (id: string, data: Partial<Delivery>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    deleteDelivery: (id: string) => Promise<boolean>

    // filters
    deliveryFilters: DeliveryFiltersState
    setDeliveryFilters: (filters: Partial<DeliveryFiltersState>) => void
    resetDeliveryFilters: () => void

    // creation sheet
    deliveryCreationSheetOpen: boolean
    setDeliveryCreationSheetOpen: (open: boolean) => void

    // detail sheet
    selectedDelivery: Delivery | null
    setSelectedDelivery: (delivery: Delivery | null) => void
    deliveryDetailSheetOpen: boolean
    setDeliveryDetailSheetOpen: (open: boolean) => void

    // form
    deliveryCreationFormData: Partial<DeliveryFormInput> | undefined
    setDeliveryCreationFormData: (data: Partial<DeliveryFormInput>) => void
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined)

export function DeliveryProvider({ children }: { children: ReactNode }) {
    const { searchInput } = useStockUIContext()

    // setDeliveryFiltersState : setter brut, exposé publiquement via l'alias setDeliveryFilters.
    // eslint-disable-next-line react-naming-convention/use-state
    const [deliveryFilters, setDeliveryFiltersState] =
        useState<DeliveryFiltersState>(DEFAULT_DELIVERY_FILTERS)
    const [deliveryCreationSheetOpen, setDeliveryCreationSheetOpen] = useState(false)
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
    const [deliveryDetailSheetOpen, setDeliveryDetailSheetOpen] = useState(false)
    const [deliveryCreationFormData, setDeliveryCreationFormData] =
        useState<Partial<DeliveryFormInput>>()

    const setDeliveryFilters = useCallback((filters: Partial<DeliveryFiltersState>) => {
        setDeliveryFiltersState((prev) => ({ ...prev, ...filters }))
    }, [])

    const resetDeliveryFilters = useCallback(() => {
        setDeliveryFiltersState(DEFAULT_DELIVERY_FILTERS)
    }, [])

    const {
        deliveries: serverDeliveries,
        fetchDeliveries,
        fetchSingleDelivery,
        fetchDeliveryByDIN,
        createDelivery: apiCreateDelivery,
        updateDelivery: apiUpdateDelivery,
        deleteDelivery: apiDeleteDelivery,
    } = useDelivery()

    const deliveryApi = useMemo(
        () => ({
            create: apiCreateDelivery,
            update: apiUpdateDelivery,
            delete: apiDeleteDelivery,
            refetch: fetchDeliveries,
        }),
        [apiCreateDelivery, apiUpdateDelivery, apiDeleteDelivery, fetchDeliveries]
    )

    const onDeliveryError = useCallback(
        (action: string) =>
            toast.error(`Erreur lors de l'action sur la livraison : ${action}`),
        []
    )

    const {
        items: deliveries,
        create: createDelivery,
        update: updateDelivery,
        remove: deleteDelivery,
    } = useOptimisticCrud<Delivery, DeliveryFormInput>(
        serverDeliveries,
        deliveryApi,
        onDeliveryError
    )

    const filteredDeliveries = useMemo(() => {
        if (!deliveries) return []
        let result = [...deliveries]

        if (deliveryFilters.fournisseur_id !== "all")
            result = result.filter((d) => d.fournisseur_id === deliveryFilters.fournisseur_id)
        if (deliveryFilters.type !== "all")
            result = result.filter((d) => d.delivery_type === deliveryFilters.type)
        if (deliveryFilters.dateFrom)
            result = result.filter(
                (d) => d.delivery_date && d.delivery_date >= deliveryFilters.dateFrom
            )
        if (deliveryFilters.dateTo)
            result = result.filter(
                (d) => d.delivery_date && d.delivery_date <= deliveryFilters.dateTo
            )
        if (deliveryFilters.ballsCountMin)
            result = result.filter(
                (d) => (d.balles_count ?? 0) >= Number(deliveryFilters.ballsCountMin)
            )
        if (deliveryFilters.ballsCountMax)
            result = result.filter(
                (d) => (d.balles_count ?? 0) <= Number(deliveryFilters.ballsCountMax)
            )
        if (searchInput.trim()) {
            const s = searchInput.toLowerCase()
            result = result.filter(
                (d) =>
                    d.din?.toLowerCase().includes(s) ||
                    d.fournisseur?.name?.toLowerCase().includes(s)
            )
        }

        return result
    }, [deliveries, deliveryFilters, searchInput])

    const value = useMemo(
        () => ({
            deliveries,
            filteredDeliveries,
            fetchDeliveries,
            fetchSingleDelivery,
            fetchDeliveryByDIN,
            createDelivery,
            updateDelivery,
            deleteDelivery,
            deliveryFilters,
            setDeliveryFilters,
            resetDeliveryFilters,
            deliveryCreationSheetOpen,
            setDeliveryCreationSheetOpen,
            selectedDelivery,
            setSelectedDelivery,
            deliveryDetailSheetOpen,
            setDeliveryDetailSheetOpen,
            deliveryCreationFormData,
            setDeliveryCreationFormData,
        }),
        [
            deliveries,
            filteredDeliveries,
            fetchDeliveries,
            fetchSingleDelivery,
            fetchDeliveryByDIN,
            createDelivery,
            updateDelivery,
            deleteDelivery,
            deliveryFilters,
            setDeliveryFilters,
            resetDeliveryFilters,
            deliveryCreationSheetOpen,
            selectedDelivery,
            deliveryDetailSheetOpen,
            deliveryCreationFormData,
        ]
    )

    return <DeliveryContext value={value}>{children}</DeliveryContext>
}

export function useDeliveryContext() {
    const context = use(DeliveryContext)
    if (!context) {
        throw new Error("useDeliveryContext must be used within a DeliveryProvider")
    }
    return context
}
