import { useState } from "react"
import { Check, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Label } from "@/shared/ui/atoms/label"
import { SearchSelect, type SearchSelectOption } from "@/shared/ui/molecules/search-select"
import type { PackingLabelMapping } from "@/features/stock/types/packing-list.types"

interface PackingMappingEditRowProps {
    mapping: PackingLabelMapping
    categoryOptions: SearchSelectOption[]
    onSave: (categoryId: string) => void
    onCancel: () => void
}

/**
 * Correction d'une correspondance apprise. Seule la CATÉGORIE est modifiable :
 * le libellé, lui, appartient au fournisseur — le réécrire reviendrait à
 * inventer une clé qu'aucun fichier ne porterait, et la correspondance ne
 * s'appliquerait plus jamais.
 */
export function PackingMappingEditRow({
    mapping,
    categoryOptions,
    onSave,
    onCancel,
}: PackingMappingEditRowProps) {
    const [categoryId, setCategoryId] = useState(mapping.category_id)

    return (
        <div className="flex flex-col items-start gap-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-end dark:bg-primary/10">
            <div className="flex w-full flex-1 flex-col gap-3 sm:flex-row">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Label className="ml-0.5 text-xs font-medium text-muted-foreground">
                        Libellé du fournisseur
                    </Label>
                    <p
                        className="truncate py-2 font-mono text-sm text-muted-foreground"
                        title={mapping.raw_label_sample}
                    >
                        « {mapping.raw_label_sample} »
                    </p>
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-72">
                    <Label className="ml-0.5 text-xs font-medium text-muted-foreground">Catégorie</Label>
                    <SearchSelect
                        options={categoryOptions}
                        value={categoryId}
                        onChange={(value) => value && setCategoryId(value)}
                        placeholder="Choisir la catégorie…"
                        variant="button"
                        size="sm"
                        searchable
                        emptyMessage="Aucune catégorie"
                    />
                </div>
            </div>

            <div className="flex w-full shrink-0 items-center justify-end gap-2 border-t border-border pt-3 sm:w-auto sm:border-t-0 sm:pt-0">
                <Button
                    size="sm"
                    className="h-9 w-full px-0 sm:w-9"
                    onClick={() => onSave(categoryId)}
                    disabled={categoryId === mapping.category_id}
                    aria-label="Enregistrer la correspondance"
                >
                    <Check size={16} aria-hidden />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full bg-muted px-0 text-muted-foreground hover:bg-muted sm:w-9 sm:bg-transparent"
                    onClick={onCancel}
                    aria-label="Annuler"
                >
                    <X size={16} aria-hidden />
                </Button>
            </div>
        </div>
    )
}
