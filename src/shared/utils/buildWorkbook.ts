import XLSX from "xlsx-js-style"

/**
 * Construction d'un classeur Excel groupé, à bannières et sous-totaux.
 *
 * Extrait de l'export des arrivages, qui était le seul du dépôt à savoir
 * produire ce format. La mise en forme (palette, bordures, hauteurs de ligne,
 * volet figé, autofiltre) monte ici ; ce qui reste au module, ce sont ses
 * colonnes, son critère de groupement et son sous-total.
 *
 * ⚠ La sortie de l'export des arrivages doit rester **indiscernable** de celle
 * de `GenerateForSubscriber` (newsletter-console/internal/excel/generator.go) :
 * les deux alimentent le même destinataire. Toute évolution de mise en forme ici
 * se répercute donc sur un service Go qu'il faut modifier en même temps.
 */

export type ColumnEmphasis = "normal" | "important" | "alert"

export interface WorkbookColumn<T> {
    header: string
    /** Identifiant de colonne — sert à désigner celle qui porte le sous-total. */
    key: string
    /** Largeur en caractères Excel. */
    width: number
    type: "text" | "number"
    emphasis: ColumnEmphasis
    get: (row: T) => string | number
}

export interface WorkbookGroup<T> {
    /** Libellé de la bannière ouvrant le bloc. */
    banner: string
    /** Libellé du sous-total refermant le bloc. */
    totalLabel: string
    /** Valeur du sous-total, déjà mise en forme, posée dans `totalColumnKey`. */
    totalValue?: string
    rows: readonly T[]
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const HEADER_FILLS: Record<ColumnEmphasis, string> = {
    normal: "111827",
    important: "1E40AF",
    alert: "991B1B",
}

const CELL_FILLS: Record<ColumnEmphasis, [string, string]> = {
    normal: ["FFFFFF", "F3F4F6"],
    important: ["EFF6FF", "DBEAFE"],
    alert: ["FFF1F2", "FFE4E6"],
}

/**
 * Trois niveaux de gris volontairement distincts, lisibles même imprimés en
 * noir et blanc : en-tête de colonnes → bannière de groupe → sous-total.
 */
const GROUP_BANNER_FILL = "374151"
const GROUP_TOTAL_FILL = "D1D5DB"

// ─── Styles ───────────────────────────────────────────────────────────────────

const BORDER = (rgb: string) => ({ style: "thin", color: { rgb } })

function sHeader(emphasis: ColumnEmphasis) {
    return {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
        fill: { fgColor: { rgb: HEADER_FILLS[emphasis] } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: BORDER("374151"),
            bottom: BORDER("374151"),
            left: BORDER("374151"),
            right: BORDER("374151"),
        },
    }
}

function sCell(emphasis: ColumnEmphasis, alt: boolean, isNum = false) {
    return {
        font: { sz: 10, name: "Calibri" },
        fill: { fgColor: { rgb: CELL_FILLS[emphasis][alt ? 1 : 0] } },
        alignment: { horizontal: isNum ? "right" : "left", vertical: "center", wrapText: false },
        border: {
            top: BORDER("E5E7EB"),
            bottom: BORDER("E5E7EB"),
            left: BORDER("E5E7EB"),
            right: BORDER("E5E7EB"),
        },
    }
}

const GROUP_BORDER = {
    top: { style: "medium", color: { rgb: "9CA3AF" } },
    bottom: { style: "medium", color: { rgb: "9CA3AF" } },
    left: BORDER("9CA3AF"),
    right: BORDER("9CA3AF"),
}

/** Bannière ouvrant un bloc — plus sombre que le sous-total. */
function sGroupBanner() {
    return {
        font: { bold: true, sz: 10, name: "Calibri", color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: GROUP_BANNER_FILL } },
        alignment: { horizontal: "left", vertical: "center" },
        border: GROUP_BORDER,
    }
}

function sGroupTotal(rightAligned = false) {
    return {
        font: { bold: true, sz: 10, name: "Calibri", color: { rgb: "111827" } },
        fill: { fgColor: { rgb: GROUP_TOTAL_FILL } },
        alignment: { horizontal: rightAligned ? "right" : "left", vertical: "center" },
        border: GROUP_BORDER,
    }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

const HEADER_ROW_HEIGHT = 22
const BANNER_ROW_HEIGHT = 20

interface BuildWorkbookOptions<T> {
    columns: readonly WorkbookColumn<T>[]
    groups: readonly WorkbookGroup<T>[]
    sheetName: string
    /** Colonne portant la valeur de sous-total ; absente, aucune n'est écrite. */
    totalColumnKey?: string
}

export function buildWorkbook<T>({
    columns,
    groups,
    sheetName,
    totalColumnKey,
}: BuildWorkbookOptions<T>): XLSX.WorkBook {
    const wb = XLSX.utils.book_new()
    const ws: XLSX.WorkSheet = {}
    const merges: XLSX.Range[] = []
    const rowHeights: { hpt?: number }[] = [{ hpt: HEADER_ROW_HEIGHT }]

    const numCols = columns.length
    const totalColIdx = totalColumnKey
        ? columns.findIndex((col) => col.key === totalColumnKey)
        : -1
    const hasTotalCol = totalColIdx !== -1

    columns.forEach((col, c) => {
        ws[XLSX.utils.encode_cell({ r: 0, c })] = {
            v: col.header,
            t: "s",
            s: sHeader(col.emphasis),
        }
    })

    let currentRow = 1

    for (const group of groups) {
        // Bannière écrite AVANT les lignes du groupe : posée en dessous, elle se
        // lisait comme l'en-tête du groupe suivant.
        const bannerRow = currentRow
        columns.forEach((_, c) => {
            ws[XLSX.utils.encode_cell({ r: bannerRow, c })] = {
                v: "",
                t: "s",
                s: sGroupBanner(),
            }
        })
        ws[XLSX.utils.encode_cell({ r: bannerRow, c: 0 })] = {
            v: group.banner,
            t: "s",
            s: sGroupBanner(),
        }
        if (numCols > 1) {
            merges.push({ s: { r: bannerRow, c: 0 }, e: { r: bannerRow, c: numCols - 1 } })
        }
        rowHeights[bannerRow] = { hpt: BANNER_ROW_HEIGHT }
        currentRow++

        group.rows.forEach((row, i) => {
            const alt = i % 2 === 1
            columns.forEach((col, c) => {
                const raw = col.get(row)
                const isNum = col.type === "number" && raw !== ""
                ws[XLSX.utils.encode_cell({ r: currentRow, c })] = {
                    v: raw,
                    t: isNum ? "n" : "s",
                    s: sCell(col.emphasis, alt, isNum),
                }
            })
            currentRow++
        })

        const totalRow = currentRow
        columns.forEach((_, c) => {
            ws[XLSX.utils.encode_cell({ r: totalRow, c })] = { v: "", t: "s", s: sGroupTotal() }
        })
        ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = {
            v: group.totalLabel,
            t: "s",
            s: sGroupTotal(false),
        }

        if (hasTotalCol && group.totalValue !== undefined) {
            ws[XLSX.utils.encode_cell({ r: totalRow, c: totalColIdx })] = {
                v: group.totalValue,
                t: "s",
                s: sGroupTotal(true),
            }
        }

        // Le libellé s'étend jusqu'à la colonne précédant le total ; ce qui suit
        // le total est fusionné à part, pour que la valeur reste isolée.
        const labelMergeEnd = hasTotalCol ? Math.max(0, totalColIdx - 1) : numCols - 1
        if (labelMergeEnd > 0) {
            merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: labelMergeEnd } })
        }
        if (hasTotalCol && totalColIdx < numCols - 1) {
            merges.push({
                s: { r: totalRow, c: totalColIdx + 1 },
                e: { r: totalRow, c: numCols - 1 },
            })
        }

        currentRow++
    }

    ws["!ref"] = XLSX.utils.encode_range(
        { r: 0, c: 0 },
        { r: Math.max(0, currentRow - 1), c: numCols - 1 },
    )
    ws["!cols"] = columns.map((col) => ({ wch: col.width }))
    ws["!rows"] = rowHeights
    ws["!freeze"] = { xSplit: 0, ySplit: 1 }
    ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: 0, c: numCols - 1 }),
    }
    if (merges.length > 0) ws["!merges"] = merges

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    return wb
}
