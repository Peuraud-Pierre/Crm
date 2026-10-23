import { useMemo } from "react"
import { Shirt } from "lucide-react"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"

interface CategoriePickerProps {
    value: string
    onChange: (categoryId: string) => void
    /** Catégories déjà prises ailleurs (lignes d'une même commande). */
    exclude?: ReadonlySet<string>
    showValidation?: boolean
    placeholder?: string
}

/**
 * Choix d'une catégorie de vêtements — le référentiel du stock principal.
 * La valeur courante reste toujours proposée, même exclue ailleurs.
 */
export function CategoriePicker({ value, onChange, exclude, showValidation, placeholder = "Choisir la catégorie" }: CategoriePickerProps) {
    const { categories } = useCommandeContext()
    const options = useMemo(
        () => categories
            .filter((c) => c.id === value || !exclude?.has(c.id))
            .map((c) => ({ value: c.id, label: c.name, icon: Shirt }))
            .sort((a, b) => a.label.localeCompare(b.label, "fr")),
        [categories, exclude, value],
    )
    return (
        <SearchSelect
            options={options}
            value={value}
            onChange={(v) => onChange(v)}
            placeholder={placeholder}
            variant="input"
            size="md"
            required
            showValidation={showValidation}
            emptyMessage="Aucune catégorie : ajoutez-en dans les réglages du stock"
        />
    )
}
