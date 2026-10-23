import { useCallback, useState } from "react"
import { Building2 } from "lucide-react"
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
import { countBallesForFournisseur } from "@/features/stock_handpick/services/categorieHandpickService"
import { handpickErrorMessage } from "@/features/stock_handpick/utils/crudErrors"
import type {
    FournisseurWithCategories,
} from "@/features/stock_handpick/types/referential.types"
import type { FournisseurWritable } from "@/features/stock_handpick/services/fournisseurHandpickService"
import { FournisseurEditRow } from "./FournisseurEditRow"
import { FournisseurCreationSheet } from "./FournisseurCreationSheet"

const COLUMNS: ReferentialColumn<FournisseurWithCategories>[] = [
    {
        key: "name",
        header: "Nom",
        primary: true,
        cell: (fournisseur) => fournisseur.name,
    },
    {
        key: "tag",
        header: "Tag",
        className: "w-24",
        cell: (fournisseur) =>
            fournisseur.tag ? (
                <span className="font-mono text-sm">{fournisseur.tag}</span>
            ) : (
                <span className="text-muted-foreground/70">—</span>
            ),
    },
    {
        key: "active",
        header: "Statut",
        className: "w-24",
        cell: (fournisseur) =>
            fournisseur.is_active ? (
                <span className="text-sm text-foreground">Actif</span>
            ) : (
                <span className="text-sm text-muted-foreground">Inactif</span>
            ),
    },
]

export default function FournisseursMenu() {
    const { hasPermission } = useAuth()
    const {
        fournisseursWithCategories,
        loading,
        createFournisseur,
        updateFournisseur,
        removeFournisseur,
    } = useReferentialHandpickContext()

    const [creationOpen, setCreationOpen] = useState(false)

    const matches = useCallback(
        (fournisseur: FournisseurWithCategories, query: string) =>
            fournisseur.name.toLowerCase().includes(query) ||
            (fournisseur.tag ?? "").toLowerCase().includes(query),
        [],
    )

    /**
     * `balles_handpick.fournisseur_id` est en ON DELETE RESTRICT : la
     * suppression échouera si des balles y réfèrent. On compte AVANT l'appel
     * pour transformer une 23503 brute en message actionnable, et pour
     * orienter vers la désactivation.
     */
    const handleDelete = useCallback(
        async (fournisseur: FournisseurWithCategories) => {
            let usageCount = 0
            try {
                usageCount = await countBallesForFournisseur(fournisseur.id)
            } catch {
                // Comptage indisponible : on tente quand même la suppression,
                // l'erreur PostgREST restera lisible sans le chiffre.
            }

            if (usageCount > 0) {
                toast.error(
                    handpickErrorMessage("de l'usine", "delete", { code: "23503" }, usageCount),
                )
                return
            }

            await removeFournisseur(fournisseur.id)
        },
        [removeFournisseur],
    )

    /** Vrai si l'usine a été enregistrée : la ligne d'édition ne se referme qu'alors. */
    const handleSaveEdit = useCallback(
        (fournisseur: FournisseurWithCategories, payload: Partial<FournisseurWritable>) =>
            updateFournisseur(fournisseur.id, payload),
        [updateFournisseur],
    )

    /** Vrai si la création a abouti. */
    const handleCreate = useCallback(
        async (payload: FournisseurWritable): Promise<boolean> =>
            (await createFournisseur(payload)) !== null,
        [createFournisseur],
    )

    return (
        <ReferentialPanel
            canCreate={hasPermission(STOCK_HANDPICK_PERMISSIONS.settingsCreate)}
            canUpdate={hasPermission(STOCK_HANDPICK_PERMISSIONS.settingsUpdate)}
            canDelete={hasPermission(STOCK_HANDPICK_PERMISSIONS.settingsDelete)}
            sectionTheme={HANDPICK_THEME.settings.section}
            pageSize={SETTINGS_PAGE_SIZE}
            labels={{
                title: "Usines",
                description:
                    "Gérez les usines du stock handpick.",
                searchPlaceholder: "Rechercher une usine…",
                createLabel: "Nouvelle usine",
                emptyTitle: "Aucune usine",
                emptyHint:
                    "Ajoutez une usine pour pouvoir saisir des balles.",
                unit: "usine",
            }}
            icon={Building2}
            items={fournisseursWithCategories}
            loading={loading}
            columns={COLUMNS}
            matches={matches}
            itemLabel={(fournisseur) => fournisseur.name}
            onDelete={handleDelete}
            renderEditRow={(fournisseur, done) => (
                <FournisseurEditRow
                    fournisseur={fournisseur}
                    onSave={async (payload) => {
                        // La ligne ne se referme qu'une fois l'écriture
                        // aboutie : la refermer avant laissait croire à un
                        // enregistrement que la base avait peut-être refusé.
                        if (await handleSaveEdit(fournisseur, payload)) done()
                    }}
                    onCancel={done}
                />
            )}
            onCreateClick={() => setCreationOpen(true)}
            createSheet={
                <FournisseurCreationSheet
                    open={creationOpen}
                    onClose={() => setCreationOpen(false)}
                    onCreate={handleCreate}
                />
            }
        />
    )
}
