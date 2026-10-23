import { format } from "date-fns"
import { fr } from "date-fns/locale"
import XLSX from "xlsx-js-style"
import { buildWorkbook, type WorkbookColumn } from "@/shared/utils/buildWorkbook"
import {
    FLUX_STATUS_CONFIG,
    MOUVEMENT_DIRECTION_LABELS,
} from "@/features/stock_handpick/constants"
import {
    referenceFlux,
    type FluxHandpickRow,
} from "@/features/stock_handpick/types/flux.types"

/**
 * Export Excel des expéditions, au même format que celui des arrivages du stock
 * principal : groupement par mois, bannière, sous-total de poids refermant le
 * bloc.
 *
 * Une ligne du classeur = une expédition, pas une ligne de colisage. Le détail
 * se consulte dans l'application ; l'export sert le suivi logistique, qui
 * raisonne au conteneur.
 */

function fmtDate(value: string | null): string {
    if (!value) return ""
    try {
        const date = value.length === 10 ? new Date(`${value}T00:00`) : new Date(value)
        return format(date, "dd/MM/yy")
    } catch {
        return value
    }
}

function fmtDatetime(value: string | null): string {
    if (!value) return ""
    try {
        const d = new Date(value)
        return `${format(d, "EEEE", { locale: fr })} ${format(d, "dd/MM/yy")} · ${format(d, "HH:mm")}`
    } catch {
        return value
    }
}

const COLUMNS: WorkbookColumn<FluxHandpickRow>[] = [
    {
        header: "Statut", key: "status", width: 13, type: "text", emphasis: "normal",
        get: (f) => FLUX_STATUS_CONFIG[f.status]?.label ?? f.status,
    },
    {
        header: "Sens", key: "direction", width: 11, type: "text", emphasis: "normal",
        get: (f) => MOUVEMENT_DIRECTION_LABELS[f.direction],
    },
    {
        header: "Usine", key: "fournisseur", width: 22, type: "text", emphasis: "normal",
        get: (f) => f.fournisseur?.name ?? "",
    },
    {
        header: "Type", key: "type", width: 16, type: "text", emphasis: "normal",
        get: (f) => f.type ?? "",
    },
    {
        header: "Départ", key: "departure_date", width: 12, type: "text", emphasis: "normal",
        get: (f) => fmtDate(f.departure_date),
    },
    {
        header: "Déchargement", key: "prev_dechargement_at", width: 22, type: "text", emphasis: "important",
        get: (f) => fmtDatetime(f.prev_dechargement_at),
    },
    {
        header: "Poids (kg)", key: "total_weight_kg", width: 11, type: "number", emphasis: "normal",
        get: (f) => (f.total_weight_kg > 0 ? f.total_weight_kg : ""),
    },
    {
        header: "Quantité", key: "total_qty", width: 10, type: "number", emphasis: "normal",
        get: (f) => (f.total_qty > 0 ? f.total_qty : ""),
    },
    {
        header: "Notes", key: "notes", width: 36, type: "text", emphasis: "normal",
        get: (f) => f.notes ?? "",
    },
]

interface MonthGroup {
    label: string
    ts: number
    rows: FluxHandpickRow[]
    totalWeight: number
}

/**
 * Groupe par mois de la DATE DE RÉFÉRENCE (déchargement prévu → Le Havre →
 * départ), comme le tableau à l'écran — un export qui trierait autrement que
 * l'écran serait illisible pour qui vient de le consulter.
 */
function groupByMonth(rows: readonly FluxHandpickRow[]): MonthGroup[] {
    const map = new Map<string, MonthGroup>()

    for (const row of rows) {
        const ref = referenceFlux(row)
        let label: string
        let ts: number

        if (!ref) {
            label = "Sans date"
            // `0` place le groupe en dernier au tri décroissant : une expédition
            // sans date n'a pas à s'intercaler entre deux mois.
            ts = 0
        } else {
            const d = new Date(ref)
            const raw = format(d, "MMMM yyyy", { locale: fr })
            label = raw.charAt(0).toUpperCase() + raw.slice(1)
            ts = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
        }

        const group = map.get(label) ?? { label, ts, rows: [], totalWeight: 0 }
        group.rows.push(row)
        group.totalWeight += row.total_weight_kg
        map.set(label, group)
    }

    return [...map.values()].sort((a, b) => b.ts - a.ts)
}

/** Restreint aux expéditions dont la date de référence tombe dans la plage, bornes incluses. */
export function filterFluxByRange(
    rows: readonly FluxHandpickRow[],
    from: Date,
    to: Date,
): FluxHandpickRow[] {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime()

    return rows.filter((row) => {
        const ref = referenceFlux(row)
        if (!ref) return false
        const t = new Date(ref).getTime()
        return t >= start && t <= end
    })
}

export function buildFluxWorkbook(rows: readonly FluxHandpickRow[]): XLSX.WorkBook {
    return buildWorkbook({
        columns: COLUMNS,
        groups: groupByMonth(rows).map((group) => ({
            banner: `${group.label} — ${group.rows.length} expédition${group.rows.length > 1 ? "s" : ""}`,
            totalLabel: `↳ Total ${group.label}`,
            totalValue: `${group.totalWeight.toLocaleString("fr-FR")} kg`,
            rows: group.rows,
        })),
        sheetName: "Expéditions",
        totalColumnKey: "total_weight_kg",
    })
}

export function exportFlux(rows: readonly FluxHandpickRow[], suffix = "") {
    const wb = buildFluxWorkbook(rows)
    const date = format(new Date(), "yyyy-MM-dd")
    XLSX.writeFile(wb, `flux-handpick${suffix}_${date}.xlsx`)
}
