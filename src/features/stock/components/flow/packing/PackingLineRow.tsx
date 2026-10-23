import { AlertTriangle } from "lucide-react"
import { SearchSelect, type SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { TruncatedText } from "@/shared/ui/molecules/truncated-text"
import { cn } from "@/shared/lib/utils"
import type { PackingListLigne } from "@/features/stock/types/packing-list.types"
import {
    formatLineMeta,
    formatNumber,
    formatPackages,
    formatUnitsPerPackage,
} from "./packingFormat"

interface PackingLineRowProps {
    ligne: PackingListLigne
    categoryOptions: SearchSelectOption[]
    categoryName: (id: string | null) => string
    /** Absent : lecture seule. */
    onAssign?: (categoryId: string) => void
    /** Absent : pas le droit de créer une catégorie. */
    onCreateCategory?: (query: string) => void
}

/**
 * Une ligne du fichier, dans un groupe déplié. Sert au cas qui échappe au
 * regroupement : un même libellé qui couvre deux marchandises (polos ET pulls
 * sous « PLO RalLrt »).
 *
 * La ligne se lit comme le document : « 200 pcs × 20 colis = 4 000 ». C'est ce
 * qui permet de vérifier un nombre d'un coup d'œil, sans rouvrir l'Excel — et
 * le triangle signale la ligne dont le fichier ne tombe pas juste, seule
 * relecture arithmétique nécessaire.
 */
export function PackingLineRow({
    ligne,
    categoryOptions,
    categoryName,
    onAssign,
    onCreateCategory,
}: PackingLineRowProps) {
    const expected =
        ligne.units_per_package !== null && ligne.package_count !== null
            ? ligne.units_per_package * ligne.package_count
            : null
    const mismatch =
        expected !== null &&
        (ligne.declared_total === null || Math.abs(ligne.declared_total - expected) > 0.001)

    const sourceRow = ligne.source_row ?? ligne.position + 1
    const mismatchTitle = mismatch
        ? `Le fichier annonce ${formatNumber(ligne.declared_total)} au lieu de ${formatNumber(expected)}.`
        : undefined

    return (
        <li className="flex flex-col gap-1.5 px-3 py-2 text-xs transition-colors duration-fast hover:bg-muted/40 sm:grid sm:grid-cols-12 sm:items-center sm:gap-2">
            {/* Le numéro de ligne du FICHIER : c'est lui qu'on va rechercher
                dans l'Excel du fournisseur, pas le rang à l'écran. */}
            <span className="hidden tabular-nums text-muted-foreground sm:col-span-1 sm:inline">
                L{sourceRow}
            </span>

            {/*
              * Le libellé survit sur un téléphone, et sans troncature : c'est la
              * seule chose qui informe la décision à prendre sur la ligne.
              */}
            <span
                className="font-mono text-muted-foreground break-words sm:col-span-3 sm:truncate"
                title={ligne.raw_label}
            >
                {ligne.raw_label}
            </span>

            {/* Les mêmes nombres, en une phrase sous 640 px. La duplication de
                balisage est assumée : `useIsMobile()` ne doit pas être appelé
                dans une ligne de liste (DESIGN_SYSTEM.md §13.5), et du CSS coûte
                moins cher qu'un branchement JS par ligne. */}
            <span
                className={cn(
                    "inline-flex items-center gap-1 tabular-nums text-muted-foreground sm:hidden",
                    mismatch && "text-warning",
                )}
                title={mismatchTitle}
            >
                {mismatch && <AlertTriangle size={11} aria-label="Total incohérent" />}
                {formatLineMeta({
                    sourceRow,
                    unitsPerPackage: ligne.units_per_package,
                    unitKind: ligne.unit_kind,
                    packageCount: ligne.package_count,
                    declaredTotal: ligne.declared_total,
                })}
            </span>

            <span className="hidden text-right tabular-nums sm:col-span-2 sm:inline">
                {formatUnitsPerPackage(ligne.units_per_package, ligne.unit_kind)}
            </span>
            <span className="hidden text-right tabular-nums sm:col-span-2 sm:inline">
                {formatPackages(ligne.package_count)}
            </span>
            <span
                className={cn(
                    "hidden items-center justify-end gap-1 text-right tabular-nums sm:col-span-1 sm:inline-flex",
                    mismatch && "text-warning",
                )}
                title={mismatchTitle}
            >
                {mismatch && <AlertTriangle size={11} aria-label="Total incohérent" />}
                {formatNumber(ligne.declared_total)}
            </span>

            <div className="sm:col-span-3">
                {onAssign ? (
                    <SearchSelect
                        options={categoryOptions}
                        value={ligne.category_id ?? ""}
                        onChange={(value) => value && onAssign(value)}
                        placeholder="Choisir…"
                        variant="button"
                        size="sm"
                        searchable
                        emptyMessage="Aucune catégorie"
                        onCreate={onCreateCategory}
                        createLabel="Nouvelle catégorie"
                    />
                ) : (
                    <TruncatedText
                        text={categoryName(ligne.category_id)}
                        className={cn(!ligne.category_id && "text-destructive")}
                    />
                )}
            </div>
        </li>
    )
}
