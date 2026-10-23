import type { ArrivageStatus } from "./stock.types"
import type { PackingListSummary } from "./packing-list.types"

export interface ArrivageManuelRow {
    id: string
    container_no: string
    conteneur_no_raw: string | null
    fournisseur_id: string | null
    /** Résolu côté client — aucune clé étrangère en base, voir `services/dashboardWidgetService.ts`. */
    fournisseur?: {
        id: string
        name: string | null
        siege_localisation?: string | null
    } | null
    /**
     * Packing list rattachée, résolue côté client comme `fournisseur`
     * (`hooks/data/useArrivageManuel.ts`). `null` = aucune ; absent = pas
     * chargée (droit de lecture manquant, ou ligne construite ailleurs).
     */
    packing?: PackingListSummary | null
    status: ArrivageStatus
    status_auto: boolean
    transport_mode: string | null
    departure_date: string | null
    port_arrival_date: string | null
    total_weight_kg: number | null
    total_qty: number | null
    prev_dechargement_at: string | null
    notes: string | null
    invoice_date: string | null
    created_at: string
    updated_at: string
}

export interface ArrivageManuelCreateInput {
    container_no: string
    conteneur_no_raw?: string | null
    fournisseur_id?: string | null
    status?: ArrivageStatus
    transport_mode?: string | null
    departure_date?: string | null
    total_weight_kg?: number | null
    total_qty?: number | null
    invoice_date?: string | null
}

export interface ArrivageManuelUpdateInput {
    container_no?: string
    conteneur_no_raw?: string | null
    fournisseur_id?: string | null
    status?: ArrivageStatus
    status_auto?: boolean
    transport_mode?: string | null
    departure_date?: string | null
    port_arrival_date?: string | null
    total_weight_kg?: number | null
    total_qty?: number | null
    prev_dechargement_at?: string | null
    notes?: string | null
    invoice_date?: string | null
}

export function referenceArrivageManuel(row: ArrivageManuelRow): string | null {
    return row.prev_dechargement_at ?? row.port_arrival_date ?? row.departure_date ?? null
}
