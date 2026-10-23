import { GRID_COLS, GRID_GAP } from "../../constants"
import { columnEdge, rowEdge } from "../../layout/geometry"

interface Props {
    /** Nombre de lignes à tracer — au moins autant que le contenu. */
    rows: number
    colWidth: number
}

/**
 * La trame du canevas, révélée en mode édition.
 *
 * C'est le seul moment expressif de la page, et il dit quelque chose de
 * vrai : voici les douze colonnes et les lignes sur lesquelles les
 * modules se posent. Hors édition, ce calque n'est pas monté du tout —
 * un fond décoratif permanent qui ne correspond à aucune trame réelle
 * était précisément ce que cette refonte remplace.
 *
 * Les repères passent par les mêmes fonctions d'arrondi que les cartes
 * (`columnEdge` / `rowEdge`) : une trame calculée autrement ne
 * coïnciderait plus avec ce qu'elle est censée guider.
 */
export function GridGuides({ rows, colWidth }: Props) {
    if (colWidth <= 0) return null

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-in fade-in duration-base"
        >
            {Array.from({ length: GRID_COLS }, (_, col) => {
                const left = columnEdge(col, colWidth)
                const right = columnEdge(col + 1, colWidth) - GRID_GAP

                return (
                    <div
                        key={`col-${col}`}
                        className="absolute top-0 bottom-0 rounded-sm bg-muted/40"
                        style={{ left, width: right - left }}
                    />
                )
            })}

            {Array.from({ length: rows + 1 }, (_, row) => (
                <div
                    key={`row-${row}`}
                    className="absolute right-0 left-0 border-t border-border/40"
                    style={{ top: rowEdge(row) - GRID_GAP / 2 }}
                />
            ))}
        </div>
    )
}
