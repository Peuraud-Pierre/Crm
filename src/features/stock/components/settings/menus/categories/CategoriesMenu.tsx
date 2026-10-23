import { useCallback } from "react"
import { Tags } from "lucide-react"
import { useReferentialContext } from "@/features/stock/hooks/context/StockProvider"
import type { BalleCategory } from "@/features/stock/types/stock.types"
import { GESTION_THEME } from "@/features/stock/theme"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    SETTINGS_PAGE_SIZE,
    STOCK_PERMISSIONS,
} from "@/features/stock/constants"
import {
    ReferentialPanel,
    type ReferentialColumn,
} from "@/shared/ui/organisms/referential-panel"
import { CategoryEditRow } from "./CategoryEditRow"
import { CategoryCreationSheet } from "./CategoryCreationSheet"

const COLUMNS: ReferentialColumn<BalleCategory>[] = [
    {
        key: "name",
        header: "Nom",
        primary: true,
        cell: (c) => c.name,
    },
    {
        key: "unit_price",
        header: "Prix unitaire",
        className: "w-40",
        cell: (c) =>
            c.unit_price ? (
                <span className="tabular-nums">{c.unit_price.toFixed(2)} €/u</span>
            ) : (
                <span className="text-muted-foreground/70">—</span>
            ),
    },
    {
        key: "unit_weight",
        header: "Poids unitaire",
        className: "w-40",
        cell: (c) =>
            c.unit_weight ? (
                <span className="tabular-nums">{c.unit_weight.toFixed(2)} kg/u</span>
            ) : (
                <span className="text-muted-foreground/70">—</span>
            ),
    },
    {
        key: "tag",
        header: "Tag",
        className: "w-32",
        cell: (c) =>
            c.tag ? (
                <span className={GESTION_THEME.settings.list.tag}>{c.tag}</span>
            ) : (
                <span className="text-muted-foreground/70">—</span>
            ),
    },
]

export default function CategoriesMenu() {
    const { hasPermission } = useAuth()
    const {
        categories,
        createCategory,
        updateCategory,
        deleteCategory,
        categoryCreationSheetOpen,
        setCategoryCreationSheetOpen,
    } = useReferentialContext()

    const matches = useCallback(
        (c: BalleCategory, query: string) =>
            c.name.toLowerCase().includes(query) ||
            (c.tag ?? "").toLowerCase().includes(query),
        [],
    )

    return (
        <ReferentialPanel
            canCreate={hasPermission(STOCK_PERMISSIONS.settingsCreate)}
            canUpdate={hasPermission(STOCK_PERMISSIONS.settingsUpdate)}
            canDelete={hasPermission(STOCK_PERMISSIONS.settingsDelete)}
            sectionTheme={GESTION_THEME.settings.section}
            pageSize={SETTINGS_PAGE_SIZE}
            labels={{
                title: "Catégories",
                description: "Gérez les catégories de balles et leurs métadonnées de valorisation.",
                searchPlaceholder: "Rechercher une catégorie…",
                createLabel: "Nouvelle catégorie",
                emptyTitle: "Aucune catégorie",
                emptyHint: "Ajoutez une catégorie pour pouvoir lui associer des balles.",
                unit: "catégorie",
            }}
            icon={Tags}
            items={categories}
            columns={COLUMNS}
            matches={matches}
            itemLabel={(c) => c.name}
            onDelete={(c) => deleteCategory(c.id)}
            renderEditRow={(c, done) => (
                <CategoryEditRow
                    cat={c}
                    onSave={async (payload) => {
                        await updateCategory(c.id, payload)
                        done()
                    }}
                    onCancel={done}
                />
            )}
            onCreateClick={() => setCategoryCreationSheetOpen(true)}
            createSheet={
                <CategoryCreationSheet
                    open={categoryCreationSheetOpen}
                    onClose={() => setCategoryCreationSheetOpen(false)}
                    onCreate={createCategory}
                    takenTags={categories.map((c) => c.tag)}
                />
            }
        />
    )
}
