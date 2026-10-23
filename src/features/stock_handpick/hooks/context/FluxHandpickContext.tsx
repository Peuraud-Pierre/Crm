import {
    createContext,
    use,
    useCallback,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import { toast } from "sonner"
import { useFluxHandpick } from "../data/useFluxHandpick"
import { handpickErrorMessage } from "@/features/stock_handpick/utils/crudErrors"
import type {
    FluxFiltersState,
    FluxFormInput,
    FluxHandpickRow,
    MouvementDirection,
} from "@/features/stock_handpick/types/flux.types"
import {
    DEFAULT_FLUX_FILTERS,
    referenceFlux,
} from "@/features/stock_handpick/types/flux.types"

interface FluxHandpickContextValue {
    /** Toutes les expéditions chargées, sens confondus. */
    flux: FluxHandpickRow[] | undefined
    /** Expéditions d'un sens, filtres appliqués. */
    filteredFor: (direction: MouvementDirection) => FluxHandpickRow[]
    total: number
    loading: boolean
    hasMore: boolean
    loadMore: () => void

    filters: FluxFiltersState
    setFilters: (filters: FluxFiltersState) => void
    resetFilters: () => void
    hasActiveFilters: boolean

    findById: (id: string) => FluxHandpickRow | null
    /** Lecture unitaire, pour une expédition hors du palier chargé. */
    fetchById: (id: string) => Promise<FluxHandpickRow | null>
    /** L'expédition créée, ou `null` en échec (déjà signalé). */
    createFlux: (payload: FluxFormInput) => Promise<FluxHandpickRow | null>
    /** Vrai si l'écriture a abouti. */
    updateFlux: (id: string, payload: Partial<FluxFormInput>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    removeFlux: (id: string) => Promise<boolean>
    refetch: () => Promise<void>
}

const FluxHandpickContext = createContext<FluxHandpickContextValue | null>(null)

/**
 * La période filtre sur la DATE DE RÉFÉRENCE de l'expédition (déchargement
 * prévu → départ), celle-là même qui la situe dans le tableau. Filtrer sur la
 * date de saisie donnerait un résultat que l'ordre affiché ne laisse pas
 * prévoir.
 */
function withinDateRange(value: string | null, from: string | null, to: string | null): boolean {
    if (!from && !to) return true
    if (!value) return false
    const date = value.slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    return true
}

export function FluxHandpickProvider({ children }: { children: ReactNode }) {
    // Déstructuré : l'objet rendu par le hook est neuf à chaque rendu, alors
    // que chacune de ses fonctions est stable. Dépendre de l'objet recréait
    // toutes les callbacks — et la `value` — à chaque rendu du provider.
    const {
        flux,
        total,
        loading,
        hasMore,
        loadMore,
        fetchFlux,
        fetchFluxById,
        createFlux: apiCreateFlux,
        updateFlux: apiUpdateFlux,
        removeFlux: apiRemoveFlux,
    } = useFluxHandpick()
    const [filters, setFilters] = useState<FluxFiltersState>(DEFAULT_FLUX_FILTERS)

    const filtered = useMemo(() => {
        const query = filters.search.trim().toLowerCase()

        return (flux ?? []).filter((row) => {
            if (filters.status !== "all" && row.status !== filters.status) return false
            if (
                filters.fournisseur_id !== "all" &&
                row.fournisseur_id !== filters.fournisseur_id
            ) {
                return false
            }
            if (!withinDateRange(referenceFlux(row), filters.dateFrom, filters.dateTo)) {
                return false
            }

            if (!query) return true
            return (
                (row.fournisseur?.name ?? "").toLowerCase().includes(query) ||
                (row.type ?? "").toLowerCase().includes(query) ||
                (row.notes ?? "").toLowerCase().includes(query)
            )
        })
    }, [flux, filters])

    const filteredFor = useCallback(
        (direction: MouvementDirection) => filtered.filter((row) => row.direction === direction),
        [filtered],
    )

    const hasActiveFilters = useMemo(
        () =>
            (Object.keys(filters) as (keyof FluxFiltersState)[]).some(
                (key) => filters[key] !== DEFAULT_FLUX_FILTERS[key],
            ),
        [filters],
    )

    const resetFilters = useCallback(() => setFilters(DEFAULT_FLUX_FILTERS), [])

    const findById = useCallback(
        (id: string) => (flux ?? []).find((row) => row.id === id) ?? null,
        [flux],
    )

    // ─── Mutations : le toast d'erreur est posé ici ────────────────────────────
    // Les hooks de données remontent l'erreur brute ; c'est le contexte qui la
    // traduit, pour que tous les écrans du module disent la même chose. Le
    // résultat (succès ou non) remonte aux formulaires, qui ne se referment
    // qu'en cas de succès.

    const createFlux = useCallback(
        async (payload: FluxFormInput) => {
            try {
                return await apiCreateFlux(payload)
            } catch (error) {
                toast.error(handpickErrorMessage("de l'expédition", "create", error))
                return null
            }
        },
        [apiCreateFlux],
    )

    const updateFlux = useCallback(
        async (id: string, payload: Partial<FluxFormInput>) => {
            try {
                await apiUpdateFlux(id, payload)
                return true
            } catch (error) {
                toast.error(handpickErrorMessage("de l'expédition", "update", error))
                return false
            }
        },
        [apiUpdateFlux],
    )

    const removeFlux = useCallback(
        async (id: string) => {
            try {
                await apiRemoveFlux(id)
                return true
            } catch (error) {
                toast.error(handpickErrorMessage("de l'expédition", "delete", error))
                return false
            }
        },
        [apiRemoveFlux],
    )

    const value = useMemo<FluxHandpickContextValue>(
        () => ({
            flux,
            filteredFor,
            total,
            loading,
            hasMore,
            loadMore,
            filters,
            setFilters,
            resetFilters,
            hasActiveFilters,
            findById,
            fetchById: fetchFluxById,
            createFlux,
            updateFlux,
            removeFlux,
            refetch: fetchFlux,
        }),
        [
            flux, total, loading, hasMore, loadMore, fetchFlux, fetchFluxById,
            filteredFor, filters, resetFilters, hasActiveFilters, findById,
            createFlux, updateFlux, removeFlux,
        ],
    )

    return <FluxHandpickContext value={value}>{children}</FluxHandpickContext>
}

export function useFluxHandpickContext(): FluxHandpickContextValue {
    const context = use(FluxHandpickContext)
    if (!context) {
        throw new Error("useFluxHandpickContext doit être utilisé dans FluxHandpickProvider")
    }
    return context
}
