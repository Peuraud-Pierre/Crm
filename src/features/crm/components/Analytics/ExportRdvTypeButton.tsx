import { FileBarChart2 } from "lucide-react"
import XLSX from "xlsx-js-style"
import { Button } from "@/shared/ui/atoms/button"
import { useAnalytics } from "../../context/AnalyticsContext"
import type { RdvTypeRow } from "../../context/AnalyticsContext"
import { TARGET_IDS } from "./Widget/EventsPalier"

const round1 = (n: number) => Math.round(n * 10) / 10

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
}
const TOTAL_STYLE = {
    font: { bold: true, sz: 10, color: { rgb: "111827" } },
    fill: { fgColor: { rgb: "D1D5DB" } },
}
const SEP_COLORS = { black: "111827", red: "DC2626" } as const
const TREND = {
    up: {
        fill: { fgColor: { rgb: "C6EFCE" } },
        font: { bold: true, color: { rgb: "137333" } },
        alignment: { horizontal: "center" },
    },
    down: {
        fill: { fgColor: { rgb: "FFC7CE" } },
        font: { bold: true, color: { rgb: "A50E0E" } },
        alignment: { horizontal: "center" },
    },
    eq: {
        fill: { fgColor: { rgb: "D9D9D9" } },
        font: { bold: true, color: { rgb: "5F6368" } },
        alignment: { horizontal: "center" },
    },
}

function styleRow(
    ws: XLSX.WorkSheet,
    r: number,
    nbCols: number,
    style: object
) {
    for (let c = 0; c < nbCols; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        // Clone (pas de référence partagée) : xlsx-js-style associe le
        // format numérique (z) à l'objet de style au moment de la
        // sérialisation, donc réutiliser le même objet sur plusieurs
        // colonnes qui reçoivent ensuite des z différents fait fuiter le
        // format "%" d'une cellule pourcentage vers la cellule voisine.
        if (cell) cell.s = { ...style }
    }
}

// Indices de colonnes fixes (cf. formules Excel plus bas).
const C_TOTAL = 1
const C_DELTA = 2
const C_ACHAT = 3
const C_ACHAT_PCT = 4
const C_ACHAT_DELTA = 5
const C_DECOUVERTE = 6
const C_DECOUVERTE_PCT = 7
const C_DECOUVERTE_DELTA = 8
const C_VISIO = 9
const C_VISIO_PCT = 10
const C_VISIO_DELTA = 11
const NB_COLS = 12

const HEADER = [
    "Collaborateur",
    "Nbr de RDV",
    "Δ",
    "Achat",
    "Achat (%)",
    "Δ",
    "Découverte",
    "Découverte (%)",
    "Δ",
    "Visio",
    "Visio (%)",
    "Δ",
]

const COL_WIDTHS = [24, 14, 11, 12, 12, 11, 14, 14, 11, 12, 12, 11]

// ID supplémentaire affiché en dur juste APRÈS la barre noire, dans cet
// export uniquement (ne pas toucher TARGET_IDS, partagé avec le widget
// paliers / Kpis / export stats).
const EXTRA_ID = "cc288e8e-e940-44d9-948c-fa6d9366172c"

export function ExportRdvTypeButton() {
    const {
        getRdvTypeExportData,
        selectedPeriod,
        selectedFilter,
        selectedCommercial,
        crmUsers,
        exportGroups,
        exportFallbackNames,
    } = useAnalytics()

    const handleExport = () => {
        const { perCollaborator, perCollaboratorPrev, hasPrev, mode } =
            getRdvTypeExportData()
        const daily = mode === "daily"
        const wb = XLSX.utils.book_new()

        const byId = new Map(perCollaborator.map((r) => [r.userId, r]))
        const prevById = new Map(perCollaboratorPrev.map((r) => [r.userId, r]))
        const nameOf = (id: string) =>
            byId.get(id)?.name ||
            crmUsers.find((u) => u.id === id)?.name ||
            exportFallbackNames[id] ||
            id
        const nameOfPinned = (id: string) =>
            exportFallbackNames[id] ||
            crmUsers.find((u) => u.id === id)?.name ||
            byId.get(id)?.name ||
            id
        const zero = (id: string, name = nameOf(id)): RdvTypeRow => ({
            userId: id,
            name,
            total: 0,
            achat: 0,
            decouverte: 0,
            visio: 0,
        })
        const rowFor = (id: string, name = nameOf(id)): RdvTypeRow => {
            const b = byId.get(id)
            return b ? { ...b, name } : zero(id, name)
        }
        const prevRowFor = (id: string): RdvTypeRow =>
            prevById.get(id) ?? zero(id)

        const trendOf = (
            curN: number,
            prevN: number
        ): { text: string; style: object | null } => {
            if (!hasPrev || Number.isNaN(curN) || Number.isNaN(prevN))
                return { text: "", style: null }
            const up = curN > prevN
            const down = curN < prevN
            const arrow = up ? "▲" : down ? "▼" : "="
            let label: string
            if (curN === prevN) label = "0%"
            else if (prevN === 0) label = "nouv."
            else {
                const pct = round1(((curN - prevN) / prevN) * 100)
                label = `${pct > 0 ? "+" : ""}${pct}%`
            }
            return {
                text: `${arrow} ${label}`,
                style: up ? TREND.up : down ? TREND.down : TREND.eq,
            }
        }

        const aoa: (string | number)[][] = [
            ["Statistiques CRM — RDV par type"],
            [
                "Période",
                `${selectedPeriod}${selectedFilter ? ` — ${selectedFilter}` : " — toutes données"}`,
            ],
            [],
            daily ? ["Jour", ...HEADER.slice(1)] : HEADER,
        ]

        const styled: { r: number; c: number; style: object }[] = []

        const pushRow = (cur: RdvTypeRow, prev: RdvTypeRow) => {
            const r = aoa.length
            const total = trendOf(cur.total, prev.total)
            const achat = trendOf(cur.achat, prev.achat)
            const decouverte = trendOf(cur.decouverte, prev.decouverte)
            const visio = trendOf(cur.visio, prev.visio)
            aoa.push([
                cur.name,
                cur.total,
                total.text,
                cur.achat,
                0,
                achat.text,
                cur.decouverte,
                0,
                decouverte.text,
                cur.visio,
                0,
                visio.text,
            ])
            if (total.style) styled.push({ r, c: C_DELTA, style: total.style })
            if (achat.style)
                styled.push({ r, c: C_ACHAT_DELTA, style: achat.style })
            if (decouverte.style)
                styled.push({ r, c: C_DECOUVERTE_DELTA, style: decouverte.style })
            if (visio.style)
                styled.push({ r, c: C_VISIO_DELTA, style: visio.style })
        }

        type Entry =
            | { type: "row"; cur: RdvTypeRow; prev: RdvTypeRow }
            | { type: "sep"; color: string }
        const ordered: Entry[] = []
        const addRow = (id: string, name = nameOf(id)) => {
            ordered.push({
                type: "row",
                cur: rowFor(id, name),
                prev: prevRowFor(id),
            })
        }

        if (daily) {
            perCollaborator.forEach((cur) => {
                const prev = prevById.get(cur.userId) ?? zero(cur.userId, "")
                ordered.push({ type: "row", cur, prev })
            })
        } else {
            const pinnedIds = Array.from(TARGET_IDS)
            pinnedIds.forEach((id) => addRow(id, nameOfPinned(id)))

            if (exportGroups.length > 0) {
                exportGroups.forEach((g) => {
                    const before = ordered.length
                    g.ids.forEach((id) => {
                        // dé-dup des cibles épinglées et de l'ID en dur
                        // (réinséré après la barre noire, cf. plus bas)
                        if (!TARGET_IDS.has(id) && id !== EXTRA_ID) addRow(id)
                    })
                    if (g.sepAfter && ordered.length > before)
                        ordered.push({
                            type: "sep",
                            color: SEP_COLORS[g.sepAfter],
                        })
                })
            } else {
                const seen = new Set([...pinnedIds, EXTRA_ID])
                perCollaborator.forEach((r) => {
                    if (!r.userId || seen.has(r.userId)) return
                    seen.add(r.userId)
                    addRow(r.userId)
                })
            }
        }

        // On exclut les collaborateurs situés AVANT la première barre noire
        // (comptes centraux / groupe hors ventes) : ils n'apparaissent pas du
        // tout dans cet export (pas seulement grisés comme dans l'export
        // stats existant).
        const firstBlackIdx = ordered.findIndex(
            (e) => e.type === "sep" && e.color === SEP_COLORS.black
        )
        if (firstBlackIdx !== -1) ordered.splice(0, firstBlackIdx + 1)

        // Ligne en dur : EXTRA_ID apparaît en tête du bloc restant, c.-à-d.
        // juste après la barre noire (comptes exclus de cet export).
        if (!daily)
            ordered.unshift({
                type: "row",
                cur: rowFor(EXTRA_ID),
                prev: prevRowFor(EXTRA_ID),
            })

        const rowEntries = ordered.filter(
            (e): e is Extract<Entry, { type: "row" }> => e.type === "row"
        )
        const sumSide = (side: "cur" | "prev"): RdvTypeRow =>
            rowEntries.reduce(
                (acc, e) => ({
                    userId: "TOTAL",
                    name: "TOTAL",
                    total: acc.total + e[side].total,
                    achat: acc.achat + e[side].achat,
                    decouverte: acc.decouverte + e[side].decouverte,
                    visio: acc.visio + e[side].visio,
                }),
                zero("TOTAL", "TOTAL")
            )

        const totalRowIdx = aoa.length
        pushRow(sumSide("cur"), sumSide("prev"))

        const sepRows: { r: number; color: string }[] = []
        const dataRowIdxs: number[] = []
        ordered.forEach((e) => {
            if (e.type === "sep") {
                aoa.push(Array.from({ length: NB_COLS }, () => ""))
                sepRows.push({ r: aoa.length - 1, color: e.color })
            } else {
                dataRowIdxs.push(aoa.length)
                pushRow(e.cur, e.prev)
            }
        })

        const ws = XLSX.utils.aoa_to_sheet(aoa)
        ws["!cols"] = COL_WIDTHS.map((wch) => ({ wch }))
        if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 13 } }
        styleRow(ws, 3, NB_COLS, HEADER_STYLE)
        styleRow(ws, totalRowIdx, NB_COLS, TOTAL_STYLE)

        const rowsMeta: { hpt: number }[] = []
        sepRows.forEach(({ r, color }) => {
            styleRow(ws, r, NB_COLS, { fill: { fgColor: { rgb: color } } })
            rowsMeta[r] = { hpt: 6 }
        })
        ws["!rows"] = rowsMeta

        styled.forEach(({ r, c, style }) => {
            const cell = ws[XLSX.utils.encode_cell({ r, c })]
            if (cell) cell.s = style
        })

        const setFormula = (r0: number, c0: number, f: string) => {
            const addr = XLSX.utils.encode_cell({ r: r0, c: c0 })
            const prevCell = ws[addr]
            ws[addr] = { t: "n", f, s: prevCell?.s, z: prevCell?.z }
        }
        const applyPercents = (r0: number) => {
            const R = r0 + 1
            const B = XLSX.utils.encode_col(C_TOTAL)
            const D = XLSX.utils.encode_col(C_ACHAT)
            const G = XLSX.utils.encode_col(C_DECOUVERTE)
            const J = XLSX.utils.encode_col(C_VISIO)
            setFormula(
                r0,
                C_ACHAT_PCT,
                `IF(${B}${R}=0,0,ROUND(${D}${R}/${B}${R}*100,1))`
            )
            setFormula(
                r0,
                C_DECOUVERTE_PCT,
                `IF(${B}${R}=0,0,ROUND(${G}${R}/${B}${R}*100,1))`
            )
            setFormula(
                r0,
                C_VISIO_PCT,
                `IF(${B}${R}=0,0,ROUND(${J}${R}/${B}${R}*100,1))`
            )
        }
        if (dataRowIdxs.length > 0) {
            const first = Math.min(...dataRowIdxs) + 1
            const last = Math.max(...dataRowIdxs) + 1
            ;[C_TOTAL, C_ACHAT, C_DECOUVERTE, C_VISIO].forEach((c) => {
                const col = XLSX.utils.encode_col(c)
                setFormula(totalRowIdx, c, `SUM(${col}${first}:${col}${last})`)
            })
        }
        applyPercents(totalRowIdx)
        dataRowIdxs.forEach((r0) => applyPercents(r0))

        const percentCols = [C_ACHAT_PCT, C_DECOUVERTE_PCT, C_VISIO_PCT]
        ;[totalRowIdx, ...dataRowIdxs].forEach((r0) => {
            percentCols.forEach((c) => {
                const cell = ws[XLSX.utils.encode_cell({ r: r0, c })]
                if (cell) cell.z = '0.0"%"'
            })
        })

        ws["!freeze"] = { xSplit: 0, ySplit: totalRowIdx }
        XLSX.utils.book_append_sheet(wb, ws, "RDV par type")

        const today = new Date().toISOString().slice(0, 10)
        const tag = selectedFilter || selectedPeriod
        const who = daily
            ? (crmUsers.find((u) => u.id === selectedCommercial)?.name || "")
                  .replace(/\s+/g, "_")
            : ""
        XLSX.writeFile(
            wb,
            `stats_crm_rdv_types_${who ? `${who}_` : ""}${tag}_${today}.xlsx`
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="w-full lg:w-auto h-9 gap-2 rounded-xl border-dashed"
            onClick={handleExport}
            title="Exporter la répartition des RDV par type (achat / découverte / visio)"
        >
            <FileBarChart2 className="h-4 w-4 shrink-0" /> RDV par type
        </Button>
    )
}
