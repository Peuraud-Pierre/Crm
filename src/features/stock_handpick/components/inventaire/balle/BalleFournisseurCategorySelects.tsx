import { useMemo } from "react"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { useReferentialHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"

interface BalleFournisseurCategorySelectsProps {
    fournisseurId: string | null
    categoryId: string | null
    onFournisseurChange: (fournisseurId: string | null) => void
    onCategoryChange: (id: string | null) => void
    disabled?: boolean
}

/**
 * Usine et catégorie d'une balle — deux choix indépendants.
 *
 * Les usines ne déclarent plus de « catégories proposées » : toutes les
 * catégories actives sont offertes, et le trigger qui imposait la paire a été
 * retiré (migration 20260923130000).
 *
 * Une usine ou une catégorie désactivée reste proposée si elle est déjà
 * retenue : sans quoi la balle la perdrait à sa première édition.
 *
 * Les deux listes sont des `SearchSelect` et non des `<Select>` : ce sont des
 * référentiels, dont le nombre d'entrées croît avec les données.
 */
export function BalleFournisseurCategorySelects({
    fournisseurId,
    categoryId,
    onFournisseurChange,
    onCategoryChange,
    disabled = false,
}: BalleFournisseurCategorySelectsProps) {
    return (
        <>
            <BalleUsineSelect value={fournisseurId} onChange={onFournisseurChange} disabled={disabled} />
            <BalleCategorySelect value={categoryId} onChange={onCategoryChange} disabled={disabled} />
        </>
    )
}

interface ReferentialSelectProps {
    value: string | null
    onChange: (id: string | null) => void
    disabled?: boolean
    label?: string
}

const disabledClass = (disabled: boolean) =>
    disabled ? "pointer-events-none opacity-50" : undefined

export function BalleUsineSelect({ value, onChange, disabled = false, label = "Usine" }: ReferentialSelectProps) {
    const { fournisseurs } = useReferentialHandpickContext()

    const options = useMemo<SearchSelectOption[]>(
        () =>
            fournisseurs
                .filter((fournisseur) => fournisseur.is_active || fournisseur.id === value)
                .map((fournisseur) => ({
                    value: fournisseur.id,
                    label: fournisseur.is_active ? fournisseur.name : `${fournisseur.name} (inactive)`,
                })),
        [fournisseurs, value],
    )

    return (
        <SearchSelect
            label={label}
            size="md"
            variant="button"
            searchable
            options={options}
            value={value ?? ""}
            onChange={(next) => onChange(next || null)}
            placeholder="Choisir une usine"
            emptyMessage="Aucune usine"
            className={disabledClass(disabled)}
        />
    )
}

export function BalleCategorySelect({ value, onChange, disabled = false, label = "Catégorie" }: ReferentialSelectProps) {
    const { categories } = useReferentialHandpickContext()

    const options = useMemo<SearchSelectOption[]>(
        () =>
            categories
                .filter((category) => category.is_active || category.id === value)
                .map((category) => ({
                    value: category.id,
                    label: category.is_active ? category.name : `${category.name} (inactive)`,
                    subLabel: category.tag ?? undefined,
                })),
        [categories, value],
    )

    return (
        <SearchSelect
            label={label}
            size="md"
            variant="button"
            searchable
            options={options}
            value={value ?? ""}
            onChange={(next) => onChange(next || null)}
            placeholder="Choisir une catégorie"
            emptyMessage="Aucune catégorie"
            className={disabledClass(disabled)}
        />
    )
}
