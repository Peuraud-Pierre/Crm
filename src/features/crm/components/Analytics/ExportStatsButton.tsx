import { FileDown } from "lucide-react"
import XLSX from "xlsx-js-style"
import { Button } from "@/shared/ui/atoms/button"
import { useAnalytics } from "../../context/AnalyticsContext"
import type { StatRow } from "../../context/AnalyticsContext"

const round1 = (n: number) => Math.round(n * 10) / 10

// Colonnes du tableau (ordre = colonnes). `get` permet des valeurs calculées
// (taux de conversion) en plus des champs bruts.
const COLUMNS: { header: string; get: (r: StatRow) => string | number }[] = [
    { header: "Collaborateur", get: (r) => r.name },
    { header: "Activité total", get: (r) => r.activiteTotal },
    { header: "Nbr message", get: (r) => r.nbMessage },
    { header: "Nbr d'appel", get: (r) => r.nbAppel },
    { header: "Nbr mail", get: (r) => r.nbMail },
    { header: "Nbr qualification", get: (r) => r.nbQualification },
    { header: "Nbr de RDV pris", get: (r) => r.rdv },
    {
        header: "Taux conv. appel (%)",
        get: (r) => (r.nbAppel ? round1((r.rdv / r.nbAppel) * 100) : 0),
    },
    {
        header: "Taux conv. activité totale (%)",
        get: (r) =>
            r.activiteTotal ? round1((r.rdv / r.activiteTotal) * 100) : 0,
    },
]

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
}
const TOTAL_STYLE = {
    font: { bold: true, sz: 10, color: { rgb: "111827" } },
    fill: { fgColor: { rgb: "D1D5DB" } },
}

// Couleurs des barres de séparation entre groupes.
const SEP_COLORS = { black: "111827", red: "DC2626" } as const

// L'ordre d'affichage des collaborateurs (regroupements + barres de séparation)
// et les noms de repli sont désormais chargés depuis Supabase via le contexte
// Analytics (table analytics_export_collaborators).

function styleRow(
    ws: XLSX.WorkSheet,
    r: number,
    nbCols: number,
    style: object
) {
    for (let c = 0; c < nbCols; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })]
        if (cell) cell.s = style
    }
}

export function ExportStatsButton() {
    const {
        getStatsExportData,
        selectedPeriod,
        selectedFilter,
        crmUsers,
        exportGroups,
        exportFallbackNames,
    } = useAnalytics()

    const handleExport = () => {
        const {
            global,
            perCollaborator,
            globalPrev,
            perCollaboratorPrev,
            hasPrev,
        } = getStatsExportData()
        const wb = XLSX.utils.book_new()

        const byId = new Map(perCollaborator.map((r) => [r.userId, r]))
        const prevById = new Map(perCollaboratorPrev.map((r) => [r.userId, r]))
        const nameOf = (id: string) =>
            crmUsers.find((u) => u.id === id)?.name ||
            exportFallbackNames[id] ||
            byId.get(id)?.name ||
            id
        const zero = (id: string): StatRow => ({
            userId: id,
            name: nameOf(id),
            activiteTotal: 0,
            nbMessage: 0,
            nbAppel: 0,
            nbMail: 0,
            nbQualification: 0,
            rdv: 0,
            nbProforma: 0,
            ca: 0,
        })
        const rowFor = (id: string): StatRow => {
            const b = byId.get(id)
            return b ? { ...b, name: nameOf(id) } : zero(id)
        }
        const prevRowFor = (id: string): StatRow => prevById.get(id) ?? zero(id)

        // Styles des cellules de tendance (vs période précédente).
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
        const styled: { r: number; c: number; style: object }[] = []

        // En-tête : chaque colonne chiffrée est suivie d'une colonne « Δ ».
        const header: string[] = []
        COLUMNS.forEach((c, i) => {
            header.push(c.header)
            if (i > 0) header.push("Δ")
        })
        const nbCols = header.length

        const aoa: (string | number)[][] = [
            ["Statistiques CRM"],
            [
                "Période",
                `${selectedPeriod}${selectedFilter ? ` — ${selectedFilter}` : " — toutes données"}`,
            ],
            [],
            header, // index 3
        ]

        // Pousse une ligne valeur + tendance (▲/▼/=) par colonne chiffrée.
        const pushRow = (cur: StatRow, prev: StatRow) => {
            const r = aoa.length
            const cells: (string | number)[] = []
            COLUMNS.forEach((c, i) => {
                const v = c.get(cur)
                cells.push(v)
                if (i === 0) return
                if (!hasPrev) {
                    cells.push("")
                    return
                }
                const curN = Number(v)
                const prevN = Number(c.get(prev))
                if (Number.isNaN(curN) || Number.isNaN(prevN)) {
                    cells.push("")
                    return
                }
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
                cells.push(`${arrow} ${label}`)
                styled.push({
                    r,
                    c: cells.length - 1,
                    style: up ? TREND.up : down ? TREND.down : TREND.eq,
                })
            })
            aoa.push(cells)
        }

        pushRow(global, globalPrev) // index 4 : GLOBAL

        const sepRows: { r: number; color: string }[] = []
        exportGroups.forEach((g) => {
            g.ids.forEach((id) => pushRow(rowFor(id), prevRowFor(id)))
            if (g.sepAfter) {
                aoa.push(Array.from({ length: nbCols }, () => ""))
                sepRows.push({
                    r: aoa.length - 1,
                    color: SEP_COLORS[g.sepAfter],
                })
            }
        })

        // Filet de sécurité : tout collaborateur ayant des données mais absent
        // de la config (analytics_export_collaborators) est ajouté en fin de
        // tableau après une barre rouge — pour ne jamais perdre un user.
        const known = new Set(exportGroups.flatMap((g) => g.ids))
        const extras = perCollaborator
            .map((r) => r.userId)
            .filter((id) => id && !known.has(id))
        if (extras.length) {
            aoa.push(Array.from({ length: nbCols }, () => ""))
            sepRows.push({ r: aoa.length - 1, color: SEP_COLORS.red })
            extras.forEach((id) => pushRow(rowFor(id), prevRowFor(id)))
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa)
        // Largeurs : nom 24, colonnes chiffrées 16, colonnes Δ étroites (4).
        const cols: { wch: number }[] = []
        COLUMNS.forEach((_, i) => {
            cols.push({ wch: i === 0 ? 24 : 16 })
            if (i > 0) cols.push({ wch: 11 })
        })
        ws["!cols"] = cols
        if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 13 } }
        styleRow(ws, 3, nbCols, HEADER_STYLE) // en-tête tableau
        styleRow(ws, 4, nbCols, TOTAL_STYLE) // ligne GLOBAL

        const rowsMeta: { hpt: number }[] = []
        sepRows.forEach(({ r, color }) => {
            styleRow(ws, r, nbCols, { fill: { fgColor: { rgb: color } } })
            rowsMeta[r] = { hpt: 6 }
        })
        ws["!rows"] = rowsMeta

        // Styles de tendance appliqués APRÈS (priment sur le style de ligne).
        styled.forEach(({ r, c, style }) => {
            const cell = ws[XLSX.utils.encode_cell({ r, c })]
            if (cell) cell.s = style
        })

        ws["!freeze"] = { xSplit: 0, ySplit: 4 }
        XLSX.utils.book_append_sheet(wb, ws, "Statistiques CRM")

        const today = new Date().toISOString().slice(0, 10)
        const tag = selectedFilter || selectedPeriod
        XLSX.writeFile(wb, `stats_crm_${tag}_${today}.xlsx`)
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="w-full lg:w-auto h-9 gap-2 rounded-xl border-dashed"
            onClick={handleExport}
            title="Exporter les statistiques (global + par collaborateur) en Excel"
        >
            <FileDown className="h-4 w-4 shrink-0" /> Exporter
        </Button>
    )
}
