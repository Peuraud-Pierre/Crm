import { useCallback, useState } from "react"
import { Tags } from "lucide-react"
import { toast } from "sonner"
import {
    ReferentialPanel,
    type ReferentialColumn,
} from "@/shared/ui/organisms/referential-panel"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useReferentialHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import {
    SETTINGS_PAGE_SIZE,
    STOCK_HANDPICK_PERMISSIONS,
} from "@/features/stock_handpick/constants"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { countBallesForCategory } from "@/features/stock_handpick/services/categorieHandpickService"
import { handpickErrorMessage } from "@/features/stock_handpick/utils/crudErrors"
import type { CategoryHandpick } from "@/features/stock_handpick/types/referential.types"
import { CategoryEditRow } from "./CategoryEditRow"
import { CategoryCreationSheet } from "./CategoryCreationSheet"

export default function CategoriesMenu() {
    const { hasPermission } = useAuth()
    const {
        categories,
        loading,
        createCategory,
        updateCategory,
        removeCategory,
    } = useReferentialHandpickContext()

    const [creationOpen, setCreationOpen] = useState(false)

    const columns: ReferentialColumn<CategoryHandpick>[] = [
        {
            key: "name",
            header: "Nom",
            primary: true,
            cell: (category) => category.name,
        },
        {
            key: "tag",
            header: "Tag",
            className: "w-24",
            cell: (category) =>
                category.tag ? (
                    <span className="font-mono text-sm">{category.tag}</span>
                ) : (
                    <span className="text-muted-foreground/70">—</span>
                ),
        },
        {
            key: "active",
            header: "Statut",
            className: "w-24",
            cell: (category) =>
                category.is_active ? (
                    <span className="text-sm text-foreground">Active</span>
                ) : (
                    <span className="text-sm text-muted-foreground">Inactive</span>
                ),
        },
    ]

    const matches = useCallback(
        (category: CategoryHandpick, query: string) =>
            category.name.toLowerCase().includes(query) ||
            (category.tag ?? "").toLowerCase().includes(query),
        [],
    )

    /**
     * `balles_handpick.category_id` est en ON DELETE RESTRICT : on compte avant
     * l'appel pour transformer une 23503 brute en message actionnable, et pour
     * orienter vers la désactivation.
     */
    const handleDelete = useCallback(
        async (category: CategoryHandpick) => {
            let usageCount = 0
            try {
                usageCount = await countBallesForCategory(category.id)
            } catch {
                // Comptage indisponible : on laisse la base trancher.
            }

            if (usageCount > 0) {
                toast.error(
                    handpickErrorMessage("de la catégorie", "delete", { code: "23503" }, usageCount),
                )
                return
            }

            await removeCategory(category.id)
        },
        [removeCategory],
    )

    return (
        <ReferentialPanel
            canCreate={hasPermission(STOCK_HANDPICK_PERMISSIONS.settingsCreate)}
            canUpdate={hasPermission(STOCK_HANDPICK_PERMISSIONS.settingsUpdate)}
            canDelete={hasPermission(STOCK_HANDPICK_PERMISSIONS.settingsDelete)}
            sectionTheme={HANDPICK_THEME.settings.section}
            pageSize={SETTINGS_PAGE_SIZE}
            labels={{
                title: "Catégories",
                description:
                    "Gérez les catégories de balles et leurs métadonnées de valorisation.",
                searchPlaceholder: "Rechercher une catégorie…",
                createLabel: "Nouvelle catégorie",
                emptyTitle: "Aucune catégorie",
                emptyHint: "Ajoutez une catégorie pour pouvoir saisir des balles.",
                unit: "catégorie",
            }}
            icon={Tags}
            items={categories}
            loading={loading}
            columns={columns}
            matches={matches}
            itemLabel={(category) => category.name}
            onDelete={handleDelete}
            renderEditRow={(category, done) => (
                <CategoryEditRow
                    category={category}
                    onSave={(payload) => {
                        updateCategory(category.id, payload)
                        done()
                    }}
                    onCancel={done}
                />
            )}
            onCreateClick={() => setCreationOpen(true)}
            createSheet={
                <CategoryCreationSheet
                    open={creationOpen}
                    onClose={() => setCreationOpen(false)}
                    onCreate={createCategory}
                />
            }
        />
    )
}
