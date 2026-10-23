import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { SearchSelect, type SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { formatPackages } from "./packingFormat"

interface PackingBulkAssignBarProps {
    count: number
    /** Colis couverts par la sélection : la grandeur qui mesure le risque. */
    packages: number
    categoryOptions: SearchSelectOption[]
    onAssign: (categoryId: string) => void
    onSelectAll: () => void
    onClear: () => void
    /** Reste-t-il des libellés non sélectionnés ? */
    canSelectAll: boolean
}

/**
 * Attribuer une catégorie à plusieurs libellés d'un coup.
 *
 * Le geste est un ACCEPT, pas un ASSIGN : il ne remplit que les lignes encore
 * sans catégorie. C'est la distinction que ce module protège partout ailleurs —
 * un libellé dont une ligne a déjà été réattribuée à la main garde cet
 * arbitrage — et l'intitulé du bouton doit le dire, sans quoi on croirait
 * écraser.
 *
 * Le total en colis n'est pas décoratif : c'est la grandeur qui mesure le
 * risque d'une erreur de catégorie dans tout cet écran (93 lignes sur 97 de
 * GR153 ne portent aucun poids). Une sélection de quarante colis n'engage pas
 * la même chose qu'une sélection de deux.
 */
export function PackingBulkAssignBar({
    count,
    packages,
    categoryOptions,
    onAssign,
    onSelectAll,
    onClear,
    canSelectAll,
}: PackingBulkAssignBarProps) {
    return (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-raised">
            <p className="text-xs font-medium tabular-nums text-foreground">
                {count} libellé{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
                <span className="font-normal text-muted-foreground"> · {formatPackages(packages)}</span>
            </p>

            <div className="min-w-44 flex-1">
                <SearchSelect
                    options={categoryOptions}
                    value=""
                    onChange={(value) => value && onAssign(value)}
                    placeholder="Attribuer aux lignes non classées…"
                    variant="button"
                    size="sm"
                    searchable
                    emptyMessage="Aucune catégorie"
                />
            </div>

            {canSelectAll && (
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onSelectAll}>
                    Tout sélectionner
                </Button>
            )}
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1"
                onClick={onClear}
                aria-label="Effacer la sélection"
            >
                <X size={13} aria-hidden />
                Effacer
            </Button>
        </div>
    )
}
