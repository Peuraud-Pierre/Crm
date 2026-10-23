import { format } from "date-fns"
import { fr } from "date-fns/locale"
import XLSX from "xlsx-js-style"
import { buildWorkbook, type WorkbookColumn } from "@/shared/utils/buildWorkbook"
import type { FicheTriBalle, FicheTriComplete, TriSortie } from "@/features/salle-de-tri/types/tri.types"
import { formatHoraires, isBalleEcart } from "./triAnalytics"

/**
 * Export Excel de la salle de tri, au FORMAT DE LA FEUILLE PAPIER : une ligne
 * du classeur = une balle (date, fournisseur, catégorie, poids initial, puis
 * une colonne de kilos par type de sortie, écart, qualité, note, trieur).
 * Groupé par mois, sous-total des kilos triés.
 */

interface Row {
    fiche: FicheTriComplete
    balle: FicheTriBalle
}

export interface TriExportLookups {
    categoryName: (id: string) => string
    /** Types de sortie, dans l'ordre du référentiel : une colonne chacun. */
    sorties: readonly TriSortie[]
}

const kgDe = (balle: FicheTriBalle, sortieId: string) =>
    balle.repartition.find((r) => r.sortie_id === sortieId)?.poids_kg ?? ""

function columns(l: TriExportLookups): WorkbookColumn<Row>[] {
    return [
        { header: "Date du tri", key: "date", width: 12, type: "text", emphasis: "normal", get: (r) => format(new Date(`${r.fiche.date_tri}T12:00:00`), "dd/MM/yy") },
        { header: "Fiche", key: "fiche", width: 9, type: "text", emphasis: "normal", get: (r) => r.fiche.code },
        // Les horaires sont ceux de la FICHE : répétés sur chacune de ses balles.
        { header: "Horaires (fiche)", key: "horaires", width: 15, type: "text", emphasis: "normal", get: (r) => formatHoraires(r.fiche.heure_debut, r.fiche.heure_fin) ?? "" },
        { header: "Fournisseur", key: "fournisseur", width: 22, type: "text", emphasis: "normal", get: (r) => r.balle.fournisseur_nom ?? "" },
        { header: "Catégorie", key: "categorie", width: 24, type: "text", emphasis: "important", get: (r) => l.categoryName(r.balle.category_id) },
        { header: "Poids initial (kg)", key: "kg", width: 15, type: "number", emphasis: "important", get: (r) => r.balle.poids_initial_kg },
        ...l.sorties.map((s): WorkbookColumn<Row> => ({
            header: `${s.code} (kg)`, key: `sortie-${s.id}`, width: 10, type: "number", emphasis: "normal", get: (r) => kgDe(r.balle, s.id),
        })),
        { header: "Écart (kg)", key: "ecart", width: 11, type: "number", emphasis: "normal", get: (r) => (isBalleEcart(r.balle) ? r.balle.ecart_kg : "") },
        { header: "Qualité", key: "qualite", width: 9, type: "text", emphasis: "normal", get: (r) => "★".repeat(r.balle.qualite) },
        { header: "Note", key: "note", width: 32, type: "text", emphasis: "normal", get: (r) => r.balle.note ?? "" },
        { header: "Trieur", key: "trieur", width: 16, type: "text", emphasis: "normal", get: (r) => r.fiche.trieur_nom },
    ]
}

export function buildTriWorkbook(fiches: readonly FicheTriComplete[], lookups: TriExportLookups): XLSX.WorkBook {
    const months = new Map<string, { label: string; rows: Row[]; kg: number }>()
    for (const fiche of fiches) {
        const key = fiche.date_tri.slice(0, 7)
        const raw = format(new Date(`${fiche.date_tri}T12:00:00`), "MMMM yyyy", { locale: fr })
        const month = months.get(key) ?? { label: raw.charAt(0).toUpperCase() + raw.slice(1), rows: [], kg: 0 }
        for (const balle of fiche.balles) {
            month.rows.push({ fiche, balle })
            month.kg += balle.poids_initial_kg
        }
        months.set(key, month)
    }
    return buildWorkbook({
        columns: columns(lookups),
        groups: [...months]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([, m]) => ({
                banner: `${m.label} — ${m.rows.length} balle${m.rows.length > 1 ? "s" : ""} triée${m.rows.length > 1 ? "s" : ""}`,
                totalLabel: `↳ Total ${m.label}`,
                totalValue: `${m.kg.toLocaleString("fr-FR")} kg`,
                rows: m.rows,
            })),
        sheetName: "Salle de tri",
        totalColumnKey: "kg",
    })
}

export function exportTri(fiches: readonly FicheTriComplete[], lookups: TriExportLookups, suffix = "") {
    XLSX.writeFile(buildTriWorkbook(fiches, lookups), `salle-de-tri${suffix}_${format(new Date(), "yyyy-MM-dd")}.xlsx`)
}

/** Fiches dont la date de tri tombe dans la plage, bornes incluses. */
export function filterTriByRange(fiches: readonly FicheTriComplete[], from: Date, to: Date): FicheTriComplete[] {
    const start = format(from, "yyyy-MM-dd")
    const end = format(to, "yyyy-MM-dd")
    return fiches.filter((f) => f.date_tri >= start && f.date_tri <= end)
}
