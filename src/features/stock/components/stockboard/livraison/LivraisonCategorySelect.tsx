import { useMemo } from "react"
import { Tag } from "lucide-react"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useReferentialContext } from "@/features/stock/hooks/context/StockProvider"

interface CategorySelectControlledProps {
    value: string
    onChange: (id: string, name: string) => void
}

export function CategorySelectControlled({ value, onChange }: CategorySelectControlledProps) {
    const { categories } = useReferentialContext()

    const options = useMemo(
        () => categories?.map(c => ({ value: c.id, label: c.name, icon: Tag })) ?? [],
        [categories]
    )

    return (
        <SearchSelect
            options={options}
            value={value}
            onChange={onChange}
            placeholder="Rechercher une catégorie..."
            variant="input"
            size="md"
            showValidation
            required
            label="Catégorie"
            tooltip="Classez l'article pour optimiser la gestion de l'inventaire."
            tooltipSide="right"
            emptyMessage="Aucune catégorie"
        />
    )
}
