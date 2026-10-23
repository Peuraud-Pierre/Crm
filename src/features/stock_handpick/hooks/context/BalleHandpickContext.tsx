import {
    createContext,
    use,
    useCallback,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import { toast } from "sonner"
import { useOptimisticCrud } from "@/shared/hooks/useOptimisticCrud"
import { useBalleHandpick } from "../data/useBalleHandpick"
import { useEmplacementHandpick } from "../data/useEmplacementHandpick"
import { handpickErrorMessage } from "@/features/stock_handpick/utils/crudErrors"
import type { BalleWritable } from "@/features/stock_handpick/services/balleHandpickService"
import type {
    BalleHandpick,
    BalleHandpickFiltersState,
} from "@/features/stock_handpick/types/balle.types"
import { DEFAULT_BALLE_HANDPICK_FILTERS } from "@/features/stock_handpick/types/balle.types"
import type {
    Emplacement,
    EmplacementOption,
    ZoneNode,
} from "@/features/stock_handpick/types/location.types"
import { matchesPlace } from "@/features/stock_handpick/utils/placeGroups"
import { usineNameOf } from "@/features/stock_handpick/utils/balleDisplay"

interface BalleHandpickContextValue {
    balles: BalleHandpick[]
    /** Résultat des filtres + recherche, calculé à la volée. */
    filteredBalles: BalleHandpick[]
    total: number
    loading: boolean
    hasMore: boolean
    loadMore: () => void

    filters: BalleHandpickFiltersState
    setFilters: (filters: BalleHandpickFiltersState) => void
    resetFilters: () => void
    search: string
    setSearch: (value: string) => void
    /** Vrai dès qu'un filtre ou une recherche est actif. */
    hasActiveFilters: boolean

    /** Emplacements du plan, à plat, pour le select de l'Inventaire. */
    emplacementOptions: EmplacementOption[]
    /** Chemin lisible d'un emplacement — « A · 01 · 3 · P02 ». */
    emplacementPath: (emplacementId: string | null | undefined) => string | null
    /** Segments du chemin d'un emplacement — ["B", "R2", "E3", "H1"]. */
    emplacementSegments: (emplacementId: string | null | undefined) => string[] | null
    /** Arbre brut du plan, pour la liaison plan ↔ emplacements. */
    planZones: ZoneNode[]
    planEmplacements: Emplacement[]
    planLoading: boolean
    refetchPlan: () => Promise<void>

    /** Lecture unitaire, pour une balle hors du palier chargé. */
    fetchById: (id: string) => Promise<BalleHandpick | null>
    /** La balle créée, ou `null` en échec (déjà signalé). */
    createBalle: (payload: BalleWritable) => Promise<BalleHandpick | null>
    /** Création en lot, tout ou rien. Vrai si toutes les balles ont été créées. */
    createBalles: (payloads: BalleWritable[]) => Promise<boolean>
    /** Vrai si l'écriture a abouti. */
    updateBalle: (id: string, payload: Partial<BalleHandpick>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    removeBalle: (id: string) => Promise<boolean>
    assignEmplacement: (id: string, emplacementId: string | null) => Promise<void>
    /** Déplace un lot vers un emplacement (`null` = non rangées). Vrai si l'écriture a abouti. */
    moveBalles: (ids: readonly string[], emplacementId: string | null) => Promise<boolean>
    /** Vrai si la balle a bien été empruntée par l'utilisateur courant. */
    borrowBalle: (id: string) => Promise<boolean>
    /** Vrai si la balle a été rendue et rangée dans `emplacementId`. */
    returnBalle: (id: string, emplacementId: string) => Promise<boolean>
    /** Vrai si la balle a été éclatée (retirée du stock). */
    eclaterBalle: (id: string) => Promise<boolean>
    refetch: () => Promise<void>
}

const BalleHandpickContext = createContext<BalleHandpickContextValue | null>(null)

function withinDateRange(value: string | null, from: string | null, to: string | null): boolean {
    if (!from && !to) return true
    if (!value) return false
    const date = value.slice(0, 10)
    if (from && date < from) return false
    if (to && date > to) return false
    return true
}

export function BalleHandpickProvider({ children }: { children: ReactNode }) {
    // Déstructuré : l'objet rendu par le hook est neuf à chaque rendu, alors
    // que chacune de ses fonctions est stable. En dépendre recréait l'API du
    // CRUD optimiste, toutes ses callbacks et la `value` à chaque rendu.
    const {
        balles: serverBalles,
        total,
        loading,
        hasMore,
        loadMore,
        fetchBalles,
        fetchSingleBalle,
        createBalle: apiCreateBalle,
        createBalles: apiCreateBalles,
        updateBalle: apiUpdateBalle,
        deleteBalle: apiDeleteBalle,
        assignEmplacement: apiAssignEmplacement,
        moveBalles: apiMoveBalles,
        borrowBalle: apiBorrowBalle,
        returnBalle: apiReturnBalle,
        eclaterBalle: apiEclaterBalle,
    } = useBalleHandpick()
    const {
        options: emplacementOptions,
        pathFor: emplacementPath,
        segmentsFor: emplacementSegments,
        zones: planZones,
        emplacements: planEmplacements,
        loading: planLoading,
        fetchPlan: refetchPlan,
    } = useEmplacementHandpick()

    const [filters, setFilters] = useState<BalleHandpickFiltersState>(
        DEFAULT_BALLE_HANDPICK_FILTERS,
    )
    const [search, setSearch] = useState("")

    const onBalleError = useCallback((action: string, error: unknown) => {
        toast.error(handpickErrorMessage("de la balle", action, error))
        console.error(error)
    }, [])

    const crudApi = useMemo(
        () => ({
            create: apiCreateBalle,
            update: apiUpdateBalle,
            delete: apiDeleteBalle,
            refetch: fetchBalles,
        }),
        [apiCreateBalle, apiUpdateBalle, apiDeleteBalle, fetchBalles],
    )

    const {
        items: balles,
        create: createBalle,
        update: updateBalle,
        remove: removeBalle,
    } = useOptimisticCrud<BalleHandpick, BalleWritable>(serverBalles, crudApi, onBalleError)

    // ─── Filtrage ──────────────────────────────────────────────────────────────
    // Côté client : le board ne détient qu'un palier de l'inventaire, et
    // filtrer en base imposerait un aller-retour à chaque frappe. L'écran
    // annonce que le filtre ne porte que sur ce palier.

    const filteredBalles = useMemo(() => {
        const query = search.trim().toLowerCase()

        return balles.filter((balle) => {
            if (filters.status !== "all" && balle.status !== filters.status) return false
            if (filters.location !== "all" && balle.location !== filters.location) return false
            if (filters.type !== "all" && balle.type !== filters.type) return false
            if (filters.fournisseur_id !== "all" && balle.fournisseur_id !== filters.fournisseur_id) {
                return false
            }
            if (filters.category_id !== "all" && balle.category_id !== filters.category_id) {
                return false
            }
            if (filters.emplacement_id !== "all" && balle.emplacement_id !== filters.emplacement_id) {
                return false
            }
            if (!matchesPlace(balle, filters.place, emplacementSegments)) return false
            if (!withinDateRange(balle.import_date, filters.dateFrom, filters.dateTo)) return false

            if (!query) return true

            // Une balle n'a pas de code lisible : la recherche porte sur son
            // libellé, sa provenance, son référentiel et son emplacement — plus
            // le début de son UUID, qui est ce que l'UI affiche.
            return (
                (balle.raw_name ?? "").toLowerCase().includes(query) ||
                (balle.provenance ?? "").toLowerCase().includes(query) ||
                (usineNameOf(balle) ?? "").toLowerCase().includes(query) ||
                (balle.category?.name ?? "").toLowerCase().includes(query) ||
                (emplacementPath(balle.emplacement_id) ?? "").toLowerCase().includes(query) ||
                balle.id.toLowerCase().startsWith(query)
            )
        })
    }, [balles, filters, search, emplacementPath, emplacementSegments])

    const hasActiveFilters = useMemo(
        () =>
            search.trim() !== "" ||
            (Object.keys(filters) as (keyof BalleHandpickFiltersState)[]).some(
                (key) => filters[key] !== DEFAULT_BALLE_HANDPICK_FILTERS[key],
            ),
        [filters, search],
    )

    const resetFilters = useCallback(() => {
        setFilters(DEFAULT_BALLE_HANDPICK_FILTERS)
        setSearch("")
    }, [])

    const assignEmplacement = useCallback(
        async (id: string, emplacementId: string | null) => {
            try {
                await apiAssignEmplacement(id, emplacementId)
                await fetchBalles()
            } catch (error) {
                toast.error(handpickErrorMessage("de l'emplacement", "update", error))
                console.error(error)
            }
        },
        [apiAssignEmplacement, fetchBalles],
    )

    const moveBalles = useCallback(
        async (ids: readonly string[], emplacementId: string | null) => {
            try {
                const moved = await apiMoveBalles(ids, emplacementId)
                await fetchBalles()
                const skipped = ids.length - moved
                toast.success(
                    `${moved} balle${moved > 1 ? "s" : ""} déplacée${moved > 1 ? "s" : ""}` +
                        (skipped > 0 ? ` · ${skipped} ignorée${skipped > 1 ? "s" : ""} (empruntée ou éclatée)` : ""),
                )
                return true
            } catch (error) {
                toast.error(handpickErrorMessage("des balles", "update", error))
                console.error(error)
                return false
            }
        },
        [apiMoveBalles, fetchBalles],
    )

    const borrowBalle = useCallback(
        async (id: string) => {
            try {
                const ok = await apiBorrowBalle(id)
                await fetchBalles()
                if (ok) toast.success("Balle empruntée")
                else toast.error("Cette balle vient d'être empruntée par quelqu'un d'autre")
                return ok
            } catch (error) {
                toast.error(handpickErrorMessage("de la balle", "update", error))
                console.error(error)
                return false
            }
        },
        [apiBorrowBalle, fetchBalles],
    )

    const returnBalle = useCallback(
        async (id: string, emplacementId: string) => {
            try {
                const ok = await apiReturnBalle(id, emplacementId)
                await fetchBalles()
                if (ok) toast.success("Balle rendue")
                else toast.error("Cette balle a déjà été rendue ou éclatée entre-temps")
                return ok
            } catch (error) {
                toast.error(handpickErrorMessage("de la balle", "update", error))
                console.error(error)
                return false
            }
        },
        [apiReturnBalle, fetchBalles],
    )

    // Pas de CRUD optimiste pour un lot : N balles fantômes à réconcilier
    // pour une écriture tout-ou-rien. On recharge une fois la base à jour.
    const createBalles = useCallback(
        async (payloads: BalleWritable[]) => {
            try {
                const created = await apiCreateBalles(payloads)
                await fetchBalles()
                toast.success(
                    created.length > 1 ? `${created.length} balles créées` : "Balle créée",
                )
                return true
            } catch (error) {
                toast.error(handpickErrorMessage("des balles", "create", error))
                console.error(error)
                return false
            }
        },
        [apiCreateBalles, fetchBalles],
    )

    const eclaterBalle = useCallback(
        async (id: string) => {
            try {
                const ok = await apiEclaterBalle(id)
                // Le plan se recharge sur le palier de l'inventaire : pas
                // besoin de le relancer ici.
                await fetchBalles()
                if (ok) toast.warning("Balle éclatée — retirée du stock")
                else toast.error("Cette balle a déjà été éclatée")
                return ok
            } catch (error) {
                toast.error(handpickErrorMessage("de la balle", "update", error))
                console.error(error)
                return false
            }
        },
        [apiEclaterBalle, fetchBalles],
    )

    const value = useMemo<BalleHandpickContextValue>(
        () => ({
            balles,
            filteredBalles,
            total,
            loading,
            hasMore,
            loadMore,
            filters,
            setFilters,
            resetFilters,
            search,
            setSearch,
            hasActiveFilters,
            emplacementOptions,
            emplacementPath,
            emplacementSegments,
            planZones,
            planEmplacements,
            planLoading,
            refetchPlan,
            fetchById: fetchSingleBalle,
            createBalle,
            createBalles,
            updateBalle,
            removeBalle,
            assignEmplacement,
            moveBalles,
            borrowBalle,
            returnBalle,
            eclaterBalle,
            refetch: fetchBalles,
        }),
        [
            balles, filteredBalles, total, loading, hasMore, loadMore, fetchBalles,
            fetchSingleBalle, filters, resetFilters, search, hasActiveFilters,
            emplacementOptions, emplacementPath, emplacementSegments,
            planZones, planEmplacements, planLoading, refetchPlan,
            createBalle, createBalles, updateBalle, removeBalle, assignEmplacement, moveBalles,
            borrowBalle, returnBalle, eclaterBalle,
        ],
    )

    return <BalleHandpickContext value={value}>{children}</BalleHandpickContext>
}

export function useBalleHandpickContext(): BalleHandpickContextValue {
    const context = use(BalleHandpickContext)
    if (!context) {
        throw new Error("useBalleHandpickContext doit être utilisé dans StockHandpickProvider")
    }
    return context
}
