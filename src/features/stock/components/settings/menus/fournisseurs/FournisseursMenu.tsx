import { useCallback, useMemo } from "react"
import { Building2, MapPin } from "lucide-react"
import {
    useArrivageManuelContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import type { Fournisseur } from "@/features/stock/types/stock.types"
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
import { FournisseurEditRow } from "./FournisseurEditRow"
import { FournisseurCreationSheet } from "./FournisseurCreationSheet"

const COLUMNS: ReferentialColumn<Fournisseur>[] = [
    {
        key: "name",
        header: "Nom",
        primary: true,
        cell: (f) => f.name,
    },
    {
        key: "siege",
        header: "Localisation",
        cell: (f) =>
            f.siege_localisation ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <MapPin size={14} />
                    {f.siege_localisation}
                </span>
            ) : (
                <span className="italic text-muted-foreground/70">Non renseignée</span>
            ),
    },
    {
        key: "tag",
        header: "Tag",
        className: "w-32",
        cell: (f) =>
            f.tag ? (
                <span className={GESTION_THEME.settings.list.tag}>{f.tag}</span>
            ) : (
                <span className="text-muted-foreground/70">—</span>
            ),
    },
]

export default function FournisseursMenu() {
    const { hasPermission } = useAuth()
    const {
        fournisseurs,
        deleteFournisseur,
        updateFournisseur,
        createFournisseur,
        fournisseurCreationSheetOpen,
        setFournisseurCreationSheetOpen,
    } = useReferentialContext()
    const { rows: arrivages } = useArrivageManuelContext()

    // Nombre d'arrivages par fournisseur : la confirmation de suppression
    // annonce l'impact réel plutôt qu'un avertissement générique. Les lignes
    // sont déjà chargées par ArrivageManuelProvider, aucune requête de plus.
    const arrivageCountById = useMemo(() => {
        const counts = new Map<string, number>()
        for (const row of arrivages ?? []) {
            if (!row.fournisseur_id) continue
            counts.set(row.fournisseur_id, (counts.get(row.fournisseur_id) ?? 0) + 1)
        }
        return counts
    }, [arrivages])

    const matches = useCallback(
        (f: Fournisseur, query: string) =>
            f.name.toLowerCase().includes(query) ||
            (f.siege_localisation ?? "").toLowerCase().includes(query) ||
            (f.tag ?? "").toLowerCase().includes(query),
        [],
    )

    // `arrivage_manuel.fournisseur_id` est un UUID nu, sans clé étrangère
    // (20260521_arrivage_manuel.sql) : contrairement à `balles_gestion` ou
    // `deliveries_gestion`, la base ne bloquera pas la suppression — les
    // arrivages concernés perdront simplement leur fournisseur. L'avertissement
    // doit donc annoncer une perte de données, pas un refus.
    const deleteImpact = useCallback(
        (f: Fournisseur) => {
            const count = arrivageCountById.get(f.id) ?? 0
            if (count === 0) {
                return "Ce fournisseur n'est rattaché à aucun arrivage. Cette action est définitive."
            }
            return `${count} arrivage${count > 1 ? "s" : ""} référence${count > 1 ? "nt" : ""} ce fournisseur et perdra${count > 1 ? "ont" : ""} cette information — aucune contrainte en base ne l'empêche. Cette action est définitive.`
        },
        [arrivageCountById],
    )

    return (
        <ReferentialPanel
            canCreate={hasPermission(STOCK_PERMISSIONS.settingsCreate)}
            canUpdate={hasPermission(STOCK_PERMISSIONS.settingsUpdate)}
            canDelete={hasPermission(STOCK_PERMISSIONS.settingsDelete)}
            sectionTheme={GESTION_THEME.settings.section}
            pageSize={SETTINGS_PAGE_SIZE}
            labels={{
                title: "Fournisseurs",
                description: "Gérez les fournisseurs utilisés par les arrivages et les balles.",
                searchPlaceholder: "Rechercher un fournisseur…",
                createLabel: "Nouveau fournisseur",
                emptyTitle: "Aucun fournisseur",
                emptyHint: "Ajoutez un fournisseur pour pouvoir le rattacher à vos arrivages.",
                unit: "fournisseur",
            }}
            icon={Building2}
            items={fournisseurs}
            columns={COLUMNS}
            matches={matches}
            itemLabel={(f) => f.name}
            deleteImpact={deleteImpact}
            onDelete={(f) => deleteFournisseur(f.id)}
            renderEditRow={(f, done) => (
                <FournisseurEditRow
                    fourn={f}
                    onSave={async (payload) => {
                        await updateFournisseur(f.id, payload)
                        done()
                    }}
                    onCancel={done}
                />
            )}
            onCreateClick={() => setFournisseurCreationSheetOpen(true)}
            createSheet={
                <FournisseurCreationSheet
                    open={fournisseurCreationSheetOpen}
                    onClose={() => setFournisseurCreationSheetOpen(false)}
                    onCreate={createFournisseur}
                />
            }
        />
    )
}
