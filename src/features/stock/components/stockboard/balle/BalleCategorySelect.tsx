import { useMemo } from "react"
import { Tag } from "lucide-react"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useBalleContext, useReferentialContext } from "@/features/stock/hooks/context/StockProvider"

export default function CategorySelect() {
    const { balleCreationFormData, setBalleCreationFormData } = useBalleContext()
    const { categories } = useReferentialContext()

    const options = useMemo(
        () => categories?.map(c => ({ value: c.id, label: c.name, icon: Tag })) ?? [],
        [categories]
    )

    return (
        <SearchSelect
            options={options}
            value={balleCreationFormData?.category_id ?? ""}
            onChange={(id) => setBalleCreationFormData({ ...balleCreationFormData, category_id: id })}
            placeholder="Rechercher une catégorie..."
            variant="input"
            size="md"
            showValidation
            label="Catégorie"
            tooltip="Définissez le type de produits contenus dans cette balle pour générer son identifiant unique (BIN)."
            emptyMessage="Aucune catégorie trouvée"
            className="max-w-md"
        />
    )
}
