import { useCallback, useMemo } from "react"
import { BookCheck } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useReferentialContext } from "@/features/stock/hooks/context/StockProvider"
import { usePackingLabelDictionary } from "@/features/stock/hooks/data/usePackingLabelDictionary"
import { usePackingModelStats } from "@/features/stock/hooks/data/usePackingModelStats"
import { SETTINGS_PAGE_SIZE, STOCK_PERMISSIONS } from "@/features/stock/constants"
import { GESTION_THEME } from "@/features/stock/theme"
import type { PackingLabelMapping } from "@/features/stock/types/packing-list.types"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { ReferentialPanel, type ReferentialColumn } from "@/shared/ui/organisms/referential-panel"
import { PackingLearningSummary } from "./PackingLearningSummary"
import { PackingMappingEditRow } from "./PackingMappingEditRow"

/**
 * Tableau de correspondance des packing lists.
 *
 * C'est la mémoire qui fait décroître le travail de vérification : à chaque
 * packing validée, les libellés du fournisseur y entrent avec leur catégorie,
 * et l'import suivant les reconnaît sans demander quoi que ce soit. Mesuré sur
 * deux conteneurs réels, le second arrivait avec 47 de ses 121 libellés déjà
 * connus.
 *
 * Aucune création à la main : une entrée n'a de valeur que parce qu'elle vient
 * d'un arbitrage humain sur un conteneur entier. Ce panneau sert à CORRIGER —
 * une erreur apprise une fois se répéterait sinon sur tous les conteneurs
 * suivants — et à OUBLIER une correspondance devenue fausse.
 *
 * Au-dessus, le résumé de l'apprentissage : le tableau ne reconnaît que des
 * libellés identiques, le modèle de `packing-api` généralise à partir des
 * mêmes décisions humaines.
 *
 * `raw_label_key` fait office d'`id` : c'est la clé primaire de la table.
 */
type MappingRow = PackingLabelMapping & { id: string }

export default function PackingDictionaryMenu() {
    const { hasPermission } = useAuth()
    const { categories } = useReferentialContext()
    const dictionary = usePackingLabelDictionary()
    const learning = usePackingModelStats()

    const categoryOptions: SearchSelectOption[] = useMemo(
        () =>
            [...categories]
                .sort((a, b) => a.name.localeCompare(b.name, "fr"))
                .map((c) => ({ value: c.id, label: c.name, subLabel: c.tag || undefined })),
        [categories],
    )
    const categoryName = useMemo(() => {
        const byId = new Map(categories.map((c) => [c.id, c.name]))
        return (id: string) => byId.get(id) ?? "Catégorie supprimée"
    }, [categories])

    const items: MappingRow[] = useMemo(
        () => dictionary.mappings.map((m) => ({ ...m, id: m.raw_label_key })),
        [dictionary.mappings],
    )

    const columns: ReferentialColumn<MappingRow>[] = useMemo(
        () => [
            {
                key: "raw_label",
                header: "Libellé du fournisseur",
                primary: true,
                cell: (m) => (
                    <span className="font-mono text-xs" title={m.raw_label_sample}>
                        « {m.raw_label_sample} »
                    </span>
                ),
            },
            {
                key: "category",
                header: "Catégorie",
                className: "w-64",
                cell: (m) => categoryName(m.category_id),
            },
            {
                key: "hit_count",
                header: "Confirmée",
                className: "w-32 text-right",
                cell: (m) => (
                    <span className="tabular-nums" title="Nombre de packings validées qui l'ont confirmée">
                        {m.hit_count} fois
                    </span>
                ),
            },
            {
                key: "last_container",
                header: "Dernier conteneur",
                className: "w-48",
                cell: (m) =>
                    m.last_container_label ? (
                        <span className="truncate text-xs">{m.last_container_label}</span>
                    ) : (
                        <span className="text-muted-foreground/70">—</span>
                    ),
            },
        ],
        [categoryName],
    )

    const matches = useCallback(
        (m: MappingRow, query: string) =>
            m.raw_label_sample.toLowerCase().includes(query) ||
            m.raw_label_key.includes(query) ||
            categoryName(m.category_id).toLowerCase().includes(query),
        [categoryName],
    )

    return (
        <div className="flex flex-col gap-4">
            <PackingLearningSummary stats={learning.stats} loading={learning.loading} error={learning.error} />
            <ReferentialPanel
                // Le tableau s'alimente par la validation d'une packing list, pas
                // à la main : pas de création, donc pas de sheet de création.
                canCreate={false}
                canUpdate={hasPermission(STOCK_PERMISSIONS.packingUpdate)}
                canDelete={hasPermission(STOCK_PERMISSIONS.packingDelete)}
                sectionTheme={GESTION_THEME.settings.section}
                pageSize={SETTINGS_PAGE_SIZE}
                labels={{
                    title: "Correspondances packing",
                    description:
                        "Libellés des fournisseurs déjà rattachés à une catégorie. Ils sont appris à chaque packing list validée et reconnus d'office aux imports suivants.",
                    searchPlaceholder: "Rechercher un libellé ou une catégorie…",
                    createLabel: "",
                    emptyTitle: "Aucune correspondance apprise",
                    emptyHint:
                        "Validez une packing list : ses libellés seront mémorisés et reconnus automatiquement sur les conteneurs suivants.",
                    unit: "correspondance",
                }}
                icon={BookCheck}
                items={items}
                loading={dictionary.loading}
                columns={columns}
                matches={matches}
                itemLabel={(m) => m.raw_label_sample}
                deleteImpact={() =>
                    "Les packings déjà validées gardent leurs catégories ; seuls les prochains imports cesseront de reconnaître ce libellé."
                }
                onDelete={(m) => dictionary.remove(m.raw_label_key)}
                renderEditRow={(m, done) => (
                    <PackingMappingEditRow
                        mapping={m}
                        categoryOptions={categoryOptions}
                        onSave={async (categoryId) => {
                            await dictionary.updateCategory(m.raw_label_key, categoryId)
                            done()
                        }}
                        onCancel={done}
                    />
                )}
                onCreateClick={() => {}}
                createSheet={null}
            />
        </div>
    )
}
