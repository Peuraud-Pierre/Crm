import {
    createContext,
    use,
    useCallback,
    useMemo,
    type ReactNode,
} from "react"
import { toast } from "sonner"
import { useOptimisticCrud } from "@/shared/hooks/useOptimisticCrud"
import { useFournisseurHandpick } from "../data/useFournisseurHandpick"
import { useCategorieHandpick } from "../data/useCategorieHandpick"
import { buildFournisseursWithCategories } from "@/features/stock_handpick/services/fournisseurHandpickService"
import type { FournisseurWritable } from "@/features/stock_handpick/services/fournisseurHandpickService"
import type { CategoryWritable } from "@/features/stock_handpick/services/categorieHandpickService"
import { handpickErrorMessage } from "@/features/stock_handpick/utils/crudErrors"
import type {
    CategoryHandpick,
    CategoryOption,
    FournisseurCategoryLink,
    FournisseurHandpick,
    FournisseurWithCategories,
} from "@/features/stock_handpick/types/referential.types"

interface ReferentialHandpickContextValue {
    fournisseurs: FournisseurHandpick[]
    categories: CategoryHandpick[]
    links: FournisseurCategoryLink[]
    /** Fournisseurs enrichis de leurs catégories autorisées. */
    fournisseursWithCategories: FournisseurWithCategories[]
    loading: boolean

    /**
     * Catégories proposées par un fournisseur — miroir UI du trigger
     * `balles_handpick_check_fournisseur_category`. Sans fournisseur choisi,
     * retourne un tableau vide : proposer toutes les catégories laisserait
     * l'utilisateur composer une paire que la base refusera.
     */
    categoriesForFournisseur: (fournisseurId: string | null) => CategoryOption[]
    /** Nombre de fournisseurs proposant une catégorie donnée. */
    fournisseurCountForCategory: (categoryId: string) => number

    /** Le fournisseur créé, ou `null` en échec (déjà signalé). */
    createFournisseur: (payload: FournisseurWritable) => Promise<FournisseurHandpick | null>
    /** Vrai si l'écriture a abouti. */
    updateFournisseur: (id: string, payload: Partial<FournisseurWritable>) => Promise<boolean>
    /** Vrai si la suppression a abouti. */
    removeFournisseur: (id: string) => Promise<boolean>
    /** Aligne les catégories rattachées à un fournisseur ; vrai si l'écriture a abouti. */
    syncFournisseurCategories: (fournisseurId: string, categoryIds: string[]) => Promise<boolean>

    createCategory: (payload: CategoryWritable) => Promise<CategoryHandpick | null>
    updateCategory: (id: string, payload: Partial<CategoryWritable>) => Promise<boolean>
    removeCategory: (id: string) => Promise<boolean>

    refetch: () => Promise<void>
}

const ReferentialHandpickContext = createContext<ReferentialHandpickContextValue | null>(null)

export function ReferentialHandpickProvider({ children }: { children: ReactNode }) {
    // Déstructurés : les objets rendus par les hooks sont neufs à chaque rendu,
    // leurs fonctions sont stables. En dépendre recréait toutes les callbacks
    // — et la `value` — à chaque rendu du provider.
    const {
        fournisseurs: serverFournisseurs,
        links,
        loading: fournisseursLoading,
        fetchFournisseurs,
        createFournisseur: apiCreateFournisseur,
        updateFournisseur: apiUpdateFournisseur,
        deleteFournisseur: apiDeleteFournisseur,
        syncCategories: apiSyncCategories,
    } = useFournisseurHandpick()
    const {
        categories: serverCategories,
        loading: categoriesLoading,
        fetchCategories,
        createCategory: apiCreateCategory,
        updateCategory: apiUpdateCategory,
        deleteCategory: apiDeleteCategory,
    } = useCategorieHandpick()

    // ─── CRUD optimiste ────────────────────────────────────────────────────────
    // Les toasts d'erreur vivent ici (et dans les hooks data), jamais dans les
    // services : ceux-ci se contentent de lever.

    const onFournisseurError = useCallback((action: string, error: unknown) => {
        toast.error(handpickErrorMessage("de l'usine", action, error))
        console.error(error)
    }, [])

    const onCategoryError = useCallback((action: string, error: unknown) => {
        toast.error(handpickErrorMessage("de la catégorie", action, error))
        console.error(error)
    }, [])

    const fournisseurCrudApi = useMemo(
        () => ({
            create: apiCreateFournisseur,
            update: apiUpdateFournisseur,
            delete: apiDeleteFournisseur,
            refetch: fetchFournisseurs,
        }),
        [apiCreateFournisseur, apiUpdateFournisseur, apiDeleteFournisseur, fetchFournisseurs],
    )

    const {
        items: fournisseurs,
        create: createFournisseur,
        update: updateFournisseur,
        remove: removeFournisseur,
    } = useOptimisticCrud<FournisseurHandpick, FournisseurWritable>(
        serverFournisseurs,
        fournisseurCrudApi,
        onFournisseurError,
    )

    const categoryCrudApi = useMemo(
        () => ({
            create: apiCreateCategory,
            update: apiUpdateCategory,
            delete: apiDeleteCategory,
            refetch: fetchCategories,
        }),
        [apiCreateCategory, apiUpdateCategory, apiDeleteCategory, fetchCategories],
    )

    const {
        items: categories,
        create: createCategory,
        update: updateCategory,
        remove: removeCategory,
    } = useOptimisticCrud<CategoryHandpick, CategoryWritable>(
        serverCategories,
        categoryCrudApi,
        onCategoryError,
    )

    // ─── Croisements ───────────────────────────────────────────────────────────

    const categoryOptions = useMemo<CategoryOption[]>(
        () =>
            categories.map(({ id, name, tag }) => ({ id, name, tag })),
        [categories],
    )

    const fournisseursWithCategories = useMemo(
        () => buildFournisseursWithCategories(fournisseurs, categoryOptions, links),
        [fournisseurs, categoryOptions, links],
    )

    const categoriesByFournisseur = useMemo(() => {
        const map = new Map<string, CategoryOption[]>()
        for (const fournisseur of fournisseursWithCategories) {
            map.set(fournisseur.id, fournisseur.categories)
        }
        return map
    }, [fournisseursWithCategories])

    const categoriesForFournisseur = useCallback(
        (fournisseurId: string | null) =>
            fournisseurId ? categoriesByFournisseur.get(fournisseurId) ?? [] : [],
        [categoriesByFournisseur],
    )

    const fournisseurCountByCategory = useMemo(() => {
        const counts = new Map<string, number>()
        for (const link of links) {
            counts.set(link.category_id, (counts.get(link.category_id) ?? 0) + 1)
        }
        return counts
    }, [links])

    const fournisseurCountForCategory = useCallback(
        (categoryId: string) => fournisseurCountByCategory.get(categoryId) ?? 0,
        [fournisseurCountByCategory],
    )

    const syncFournisseurCategories = useCallback(
        async (fournisseurId: string, categoryIds: string[]) => {
            try {
                await apiSyncCategories(fournisseurId, categoryIds)
                return true
            } catch (error) {
                toast.error(handpickErrorMessage("des catégories de l'usine", "update", error))
                console.error(error)
                return false
            }
        },
        [apiSyncCategories],
    )

    const refetch = useCallback(async () => {
        await Promise.all([fetchFournisseurs(), fetchCategories()])
    }, [fetchFournisseurs, fetchCategories])

    const value = useMemo<ReferentialHandpickContextValue>(
        () => ({
            fournisseurs,
            categories,
            links,
            fournisseursWithCategories,
            loading: fournisseursLoading || categoriesLoading,
            categoriesForFournisseur,
            fournisseurCountForCategory,
            createFournisseur,
            updateFournisseur,
            removeFournisseur,
            syncFournisseurCategories,
            createCategory,
            updateCategory,
            removeCategory,
            refetch,
        }),
        [
            fournisseurs, categories, links, fournisseursWithCategories,
            fournisseursLoading, categoriesLoading,
            categoriesForFournisseur, fournisseurCountForCategory,
            createFournisseur, updateFournisseur, removeFournisseur, syncFournisseurCategories,
            createCategory, updateCategory, removeCategory, refetch,
        ],
    )

    return (
        <ReferentialHandpickContext value={value}>
            {children}
        </ReferentialHandpickContext>
    )
}

export function useReferentialHandpickContext(): ReferentialHandpickContextValue {
    const context = use(ReferentialHandpickContext)
    if (!context) {
        throw new Error(
            "useReferentialHandpickContext doit être utilisé dans StockHandpickProvider",
        )
    }
    return context
}
