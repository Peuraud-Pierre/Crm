import { format } from "date-fns"
import XLSX from "xlsx-js-style"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import {
    CELL_FILLS,
    HEADER_FILLS,
    MONTH_BANNER_FILL,
    MONTH_TOTAL_FILL,
    PAST_CELL_FILLS,
    PAST_FONT_COLOR,
    SCHEDULED_CELL_FILL,
    SCHEDULED_DATE_FONT_COLOR,
    resolveCellFill,
    type ColDef,
    type ColEmphasis,
    type RowState,
} from "@/features/stock/utils/arrivageExportColumns"
import {
    groupByMonth,
    isArrivagePast,
    isArrivageScheduled,
    monthBannerLabel,
} from "@/features/stock/utils/arrivageGrouping"
import { isArrivageInvoiceAlert } from "@/features/stock/utils/arrivageHelpers"

// ─── Styles ───────────────────────────────────────────────────────────────────

const BORDER = (rgb: string) => ({ style: "thin", color: { rgb } })

function sHeader(emphasis: ColEmphasis) {
    return {
        font:      { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
        fill:      { fgColor: { rgb: HEADER_FILLS[emphasis] } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: BORDER("374151"), bottom: BORDER("374151"),
            left: BORDER("374151"), right: BORDER("374151"),
        },
    }
}

function sCell(col: ColDef, state: RowState, alt: boolean, isNum = false) {
    const fill = resolveCellFill(state, col.emphasis, alt)
    // La date de déchargement porte l'accent : barrée quand elle est dépassée,
    // en gras — et en rouge sur une ligne en route, où elle est la date à retenir.
    const accent = col.permKey === "prev_dechargement_at"
    const past   = state === "past"
    const color  = accent && state === "scheduled" ? SCHEDULED_DATE_FONT_COLOR : "111827"

    const font = past
        ? { sz: 10, name: "Calibri", color: { rgb: PAST_FONT_COLOR }, italic: true, strike: accent }
        : { sz: 10, name: "Calibri", bold: accent, color: { rgb: color } }

    // Le rouge sur jaune plafonne juste au-dessus du seuil AA (4,9) : les deux
    // teintes ont des luminances proches, et un rouge plus sombre n'échangerait
    // ce contraste que contre une confusion avec le quasi-noir voisin. Excel
    // n'offre aucun contour de texte comme repli — ni xlsx-js-style ni
    // excelize.Font n'exposent un tel réglage, et l'attribut OOXML `outline` est
    // un vestige de Mac Excel qu'Excel moderne ignore. L'emphase passe donc par
    // des indices non chromatiques : un point plus grand et souligné, en plus du
    // gras que cette cellule portait déjà.
    if (accent && state === "scheduled") {
        Object.assign(font, { sz: 11, underline: true })
    }

    return {
        font,
        fill:      { fgColor: { rgb: fill } },
        alignment: { horizontal: isNum ? "right" : "left", vertical: "center", wrapText: false },
        border: {
            top: BORDER("E5E7EB"), bottom: BORDER("E5E7EB"),
            left: BORDER("E5E7EB"), right: BORDER("E5E7EB"),
        },
    }
}

/**
 * État d'une ligne, dans l'ordre de priorité : un incident de facturation prime
 * sur « en route », qui prime sur le rendu neutre. `past` est exclusif des deux
 * autres (un déchargement futur rend la ligne à venir par construction).
 */
export function rowStateOf(row: ArrivageManuelRow, now: Date): RowState {
    if (isArrivageInvoiceAlert(row, now)) return "alert"
    if (isArrivagePast(row, now)) return "past"
    if (isArrivageScheduled(row, now)) return "scheduled"
    return "normal"
}

const GROUP_BORDER = {
    top:    { style: "medium", color: { rgb: "9CA3AF" } },
    bottom: { style: "medium", color: { rgb: "9CA3AF" } },
    left:   BORDER("9CA3AF"),
    right:  BORDER("9CA3AF"),
}

/** Bannière ouvrant un bloc de mois — plus sombre que le sous-total. */
function sMonthBanner() {
    return {
        font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: "FFFFFF" } },
        fill:      { fgColor: { rgb: MONTH_BANNER_FILL } },
        alignment: { horizontal: "left", vertical: "center" },
        border:    GROUP_BORDER,
    }
}

function sMonthTotal(isWeight = false) {
    return {
        font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: "111827" } },
        fill:      { fgColor: { rgb: MONTH_TOTAL_FILL } },
        alignment: { horizontal: isWeight ? "right" : "left", vertical: "center" },
        border:    GROUP_BORDER,
    }
}

// ─── Workbook builder ─────────────────────────────────────────────────────────

/**
 * Milliers séparés par une espace simple, comme `fmtWeight` côté Go.
 * `toLocaleString("fr-FR")` emploie une espace fine insécable (U+202F) : les deux
 * fichiers n'étaient alors pas identiques au caractère près.
 */
function fmtWeight(n: number): string {
    const i = Math.round(n)
    const s = String(Math.abs(i))
    const groups: string[] = []
    for (let end = s.length; end > 0; end -= 3) {
        groups.unshift(s.slice(Math.max(0, end - 3), end))
    }
    return `${i < 0 ? "-" : ""}${groups.join(" ")} kg`
}

const HEADER_ROW_HEIGHT = 22
const BANNER_ROW_HEIGHT = 20

/**
 * Construit le classeur des arrivages. Doit rester aligné sur
 * `GenerateForSubscriber` (newsletter-console/internal/excel/generator.go) :
 * mêmes colonnes, même bannière de mois, même sous-total.
 */
export function buildArrivageWorkbook(
    rows: ArrivageManuelRow[],
    cols: ColDef[],
    now: Date = new Date()
): XLSX.WorkBook {
    const wb = XLSX.utils.book_new()
    const ws: XLSX.WorkSheet = {}
    const merges: XLSX.Range[] = []
    const rowHeights: { hpt?: number }[] = [{ hpt: HEADER_ROW_HEIGHT }]

    const numCols      = cols.length
    const weightColIdx = cols.findIndex(c => c.permKey === "total_weight_kg")
    const hasWeight    = weightColIdx !== -1

    // Header row
    cols.forEach((col, c) => {
        ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: col.header, t: "s", s: sHeader(col.emphasis) }
    })

    let currentRow = 1
    const groups = groupByMonth(rows, now)

    for (const group of groups) {
        // Bannière de mois — écrite AVANT les lignes du groupe : posée en dessous,
        // elle se lisait comme l'en-tête du mois suivant.
        const bannerRow = currentRow
        cols.forEach((_, c) => {
            ws[XLSX.utils.encode_cell({ r: bannerRow, c })] = { v: "", t: "s", s: sMonthBanner() }
        })
        ws[XLSX.utils.encode_cell({ r: bannerRow, c: 0 })] = {
            v: monthBannerLabel(group), t: "s", s: sMonthBanner(),
        }
        if (numCols > 1) {
            merges.push({ s: { r: bannerRow, c: 0 }, e: { r: bannerRow, c: numCols - 1 } })
        }
        rowHeights[bannerRow] = { hpt: BANNER_ROW_HEIGHT }
        currentRow++

        // Data rows
        group.rows.forEach((row, i) => {
            const alt   = i % 2 === 1
            const state = rowStateOf(row, now)
            cols.forEach((col, c) => {
                const raw   = col.get(row)
                const isNum = col.type === "number" && raw !== ""
                ws[XLSX.utils.encode_cell({ r: currentRow, c })] = {
                    v: raw, t: isNum ? "n" : "s", s: sCell(col, state, alt, isNum),
                }
            })
            currentRow++
        })

        // Month total row
        const totalRow = currentRow

        // Fill all cells with total style
        cols.forEach((_, c) => {
            ws[XLSX.utils.encode_cell({ r: totalRow, c })] = {
                v: "", t: "s", s: sMonthTotal(),
            }
        })

        // Label in col 0
        ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })] = {
            v: `↳ Total ${group.label}`, t: "s", s: sMonthTotal(false),
        }

        // Weight value (only if the column is visible)
        if (hasWeight) {
            ws[XLSX.utils.encode_cell({ r: totalRow, c: weightColIdx })] = {
                v: fmtWeight(group.totalWeight), t: "s", s: sMonthTotal(true),
            }
        }

        // Merge label: col 0 → col before weight (or all if no weight)
        const labelMergeEnd = hasWeight ? Math.max(0, weightColIdx - 1) : numCols - 1
        if (labelMergeEnd > 0) {
            merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: labelMergeEnd } })
        }
        // Merge cells after weight column
        if (hasWeight && weightColIdx < numCols - 1) {
            merges.push({
                s: { r: totalRow, c: weightColIdx + 1 },
                e: { r: totalRow, c: numCols - 1 },
            })
        }

        currentRow++
    }

    ws["!ref"]        = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: Math.max(0, currentRow - 1), c: numCols - 1 })
    ws["!cols"]       = cols.map(col => ({ wch: col.width }))
    ws["!rows"]       = rowHeights
    ws["!freeze"]     = { xSplit: 0, ySplit: 1 }
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: 0, c: numCols - 1 }) }
    if (merges.length > 0) ws["!merges"] = merges

    XLSX.utils.book_append_sheet(wb, ws, "Arrivages")
    XLSX.utils.book_append_sheet(wb, buildLegendSheet(), "Légende")
    return wb
}

/**
 * Feuille « Légende ». Réplique de `writeLegendSheet`
 * (newsletter-console/internal/excel/generator.go) : sans elle, l'export manuel
 * livrait un code couleur que rien n'expliquait.
 *
 * L'entrée « cellule modifiée » n'y figure pas : elle n'a de sens que pour la
 * newsletter, qui seule dispose de l'état précédent.
 */
function buildLegendSheet(): XLSX.WorkSheet {
    const rows: [string, string][] = [
        [SCHEDULED_CELL_FILL, "Arrivage en route · déchargement programmé (ligne entière, date de déchargement en rouge, gras et soulignée)"],
        [CELL_FILLS.important[0], "Colonne Déchargement prévu (mise en avant systématiquement)"],
        [CELL_FILLS.alert[0], "Facture manquante · déchargement dans 7 jours ou moins"],
        [PAST_CELL_FILLS[0], "Arrivage passé · déchargement antérieur à aujourd'hui (texte grisé, date barrée)"],
    ]

    const ws: XLSX.WorkSheet = {}
    ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = {
        v: "Légende des couleurs", t: "s",
        s: { font: { bold: true, sz: 11, name: "Calibri", color: { rgb: "111827" } },
             alignment: { vertical: "center" } },
    }

    rows.forEach(([fill, label], i) => {
        const r = i + 1
        ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
            v: "", t: "s",
            s: { fill: { fgColor: { rgb: fill } }, border: LEGEND_BORDER },
        }
        ws[XLSX.utils.encode_cell({ r, c: 1 })] = {
            v: label, t: "s",
            s: { font: { sz: 10, name: "Calibri", color: { rgb: "111827" } },
                 alignment: { vertical: "center" }, border: LEGEND_BORDER },
        }
    })

    ws["!ref"]  = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: rows.length, c: 1 })
    ws["!cols"] = [{ wch: 6 }, { wch: 70 }]
    ws["!rows"] = [{ hpt: 20 }, ...rows.map(() => ({ hpt: 18 }))]
    return ws
}

const LEGEND_BORDER = {
    top: BORDER("E5E7EB"), bottom: BORDER("E5E7EB"),
    left: BORDER("E5E7EB"), right: BORDER("E5E7EB"),
}

export function exportArrivageRows(rows: ArrivageManuelRow[], cols: ColDef[], suffix = "") {
    const wb   = buildArrivageWorkbook(rows, cols)
    const date = format(new Date(), "yyyy-MM-dd")
    XLSX.writeFile(wb, `arrivages${suffix}_${date}.xlsx`)
}
