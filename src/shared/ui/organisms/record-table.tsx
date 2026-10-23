import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"

/**
 * Tableau de lignes piloté par un descripteur de colonnes.
 *
 * Pourquoi ce composant existe
 * ----------------------------
 * Les modules de stock écrivaient chacun leur table à la main sur
 * `atoms/table.tsx`, qui est un primitif HTML sans logique. Le résultat : trois
 * tables sans rien de commun, dont l'une (les arrivages, 477 lignes) portait le
 * groupement par mois, les teintes conditionnelles et un `colSpan` calculé, et
 * les deux autres rien du tout. « Même tableau d'un stock à l'autre » n'était
 * pas tenable en recopiant.
 *
 * Ce qui monte ici : le squelette, la boucle de colonnes, les largeurs, le
 * groupement avec sa bannière et son résumé aligné à droite, le repli en cartes
 * sous `md`. Ce qui reste dans la feature : les colonnes elles-mêmes (elles
 * portent le vocabulaire métier), le fetch, le tri, la pagination.
 *
 * Aucune entité métier, aucun `hasPermission` : les droits arrivent déjà
 * résolus dans la fonction `cell` d'une colonne (DESIGN_SYSTEM.md §14.3). Aucune
 * valeur Tailwind arbitraire non plus — les modules passent leurs classes, et
 * gardent ainsi leur dette chez eux plutôt que de la promouvoir en socle.
 */

export interface RecordColumn<T> {
    /** Clé stable : identifiant de colonne et clé React des cellules. */
    key: string
    /** ReactNode et non string : un en-tête peut porter une icône inline. */
    header: ReactNode
    /** Largeur posée en style inline sur le `<th>` (`"8%"`, `"7rem"`). */
    width?: string
    headClassName?: string
    /** Fonction pour les teintes par cellule (une colonne en alerte). */
    cellClassName?: string | ((row: T) => string)
    cell: (row: T) => ReactNode

    // ── Repli en cartes (ignoré si `cardList` n'est pas fourni) ──
    /** Libellé de la ligne dans la carte. Absent ⇒ colonne non reprise. */
    cardLabel?: string
    /** Cette colonne fait le titre de la carte (une seule). */
    cardPrimary?: boolean
    /** Cette colonne fait l'annotation de droite du titre (une seule). */
    cardTrailing?: boolean
    /** Omet la ligne de la carte quand ceci renvoie vrai (valeur vide). */
    cardOmitWhen?: (row: T) => boolean
    cardValueClassName?: string
}

export interface RecordGroup<T> {
    key: string
    /** Contenu de la bannière, sur toutes les colonnes sauf celles réservées. */
    banner: ReactNode
    /**
     * Résumé aligné à droite (total du mois…). `colSpan` est le nombre de
     * colonnes RÉSERVÉES en fin de ligne : le contenu occupe la première, les
     * suivantes servent de bourrage. Le `colSpan` de la bannière s'en déduit —
     * il n'y a donc plus de constante magique à maintenir à l'ajout d'une
     * colonne.
     */
    bannerTrailing?: { colSpan: number; content: ReactNode }
    rows: readonly T[]
}

interface RecordTableProps<T> {
    columns: readonly RecordColumn<T>[]
    /** Lignes à plat, ou groupes bannerisés — l'un ou l'autre. */
    rows?: readonly T[]
    groups?: readonly RecordGroup<T>[]
    rowKey: (row: T) => string

    /** Conteneur de la table — typiquement `theme.board.tableWrapper`. */
    wrapperClassName?: string
    tableClassName?: string
    headerRowClassName?: string
    /** Appliqué à chaque `<th>`, avant celui de la colonne. */
    headCellClassName?: string
    /** Appliqué à chaque `<td>`, avant celui de la colonne. */
    bodyCellClassName?: string
    rowClassName?: (row: T) => string | undefined
    onRowClick?: (row: T) => void
    /** `table-layout: fixed` — nécessaire pour que les largeurs en % tiennent. */
    fixedLayout?: boolean
    /** Remonte la table pour rejouer son animation d'entrée (n° de page). */
    animationKey?: string | number

    groupRowClassName?: string
    groupLabelClassName?: string
    groupSummaryClassName?: string

    /**
     * Classes de la liste de cartes affichée sous `md` — typiquement
     * `theme.board.cardList`. Absente, aucune carte n'est rendue : un module qui
     * a déjà une grille de cartes ailleurs n'en veut pas une seconde variante.
     */
    cardList?: string
}

export function RecordTable<T>({
    columns,
    rows,
    groups,
    rowKey,
    wrapperClassName,
    tableClassName,
    headerRowClassName,
    headCellClassName,
    bodyCellClassName,
    rowClassName,
    onRowClick,
    fixedLayout,
    animationKey,
    groupRowClassName,
    groupLabelClassName,
    groupSummaryClassName,
    cardList,
}: RecordTableProps<T>) {
    const allRows = groups ? groups.flatMap((group) => [...group.rows]) : (rows ?? [])

    const renderRow = (row: T) => (
        <TableRow
            key={rowKey(row)}
            className={cn(onRowClick && "cursor-pointer", rowClassName?.(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
            {columns.map((col) => (
                <TableCell
                    key={col.key}
                    className={cn(
                        bodyCellClassName,
                        typeof col.cellClassName === "function"
                            ? col.cellClassName(row)
                            : col.cellClassName,
                    )}
                >
                    {col.cell(row)}
                </TableCell>
            ))}
        </TableRow>
    )

    return (
        <>
            <div key={animationKey} className={wrapperClassName}>
                <Table
                    className={tableClassName}
                    style={fixedLayout ? { tableLayout: "fixed" } : undefined}
                >
                    <TableHeader>
                        <TableRow className={headerRowClassName}>
                            {columns.map((col) => (
                                <TableHead
                                    key={col.key}
                                    style={col.width ? { width: col.width } : undefined}
                                    className={cn(headCellClassName, col.headClassName)}
                                >
                                    {col.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groups
                            ? groups.map((group) => [
                                  <TableRow key={`group-${group.key}`} className={groupRowClassName}>
                                      <TableCell
                                          colSpan={
                                              columns.length - (group.bannerTrailing?.colSpan ?? 0)
                                          }
                                          className={groupLabelClassName}
                                      >
                                          {group.banner}
                                      </TableCell>
                                      {group.bannerTrailing && (
                                          <TableCell className={groupSummaryClassName}>
                                              {group.bannerTrailing.content}
                                          </TableCell>
                                      )}
                                      {group.bannerTrailing &&
                                          group.bannerTrailing.colSpan > 1 && (
                                              <TableCell
                                                  colSpan={group.bannerTrailing.colSpan - 1}
                                              />
                                          )}
                                  </TableRow>,
                                  ...group.rows.map(renderRow),
                              ])
                            : allRows.map(renderRow)}
                    </TableBody>
                </Table>
            </div>

            {cardList && (
                <div className={cardList}>
                    {allRows.map((row) => (
                        <RecordCard
                            key={rowKey(row)}
                            row={row}
                            columns={columns}
                            onClick={onRowClick}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

function RecordCard<T>({
    row,
    columns,
    onClick,
}: {
    row: T
    columns: readonly RecordColumn<T>[]
    onClick?: (row: T) => void
}) {
    const primary = columns.find((col) => col.cardPrimary)
    const trailing = columns.find((col) => col.cardTrailing)
    const listed = columns.filter(
        (col) => col.cardLabel && !col.cardOmitWhen?.(row),
    )

    return (
        <Button
            variant="outline"
            onClick={onClick ? () => onClick(row) : undefined}
            className="flex h-auto w-full flex-col items-stretch gap-2 rounded-xl p-4 text-left"
        >
            <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-foreground">
                    {primary?.cell(row)}
                </span>
                <span className="shrink-0 tabular-nums text-sm text-muted-foreground">
                    {trailing?.cell(row)}
                </span>
            </div>
            <dl className="flex flex-col gap-1 text-sm">
                {listed.map((col) => (
                    <div key={col.key} className="flex items-baseline gap-2">
                        <dt className="text-muted-foreground">{col.cardLabel}</dt>
                        <dd className={col.cardValueClassName ?? "text-foreground"}>
                            {col.cell(row)}
                        </dd>
                    </div>
                ))}
            </dl>
        </Button>
    )
}
