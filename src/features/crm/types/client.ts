/**
 * client.ts — Entités clients et filtres associés
 *
 * Regroupe la fiche client, la fiche d'appro, et tout le système
 * de filtres / groupement du board Kanban.
 */

import type { Owner } from "./user"

// ─────────────────────────────────────────────────────────────────────────────
// Fiche d'approvisionnement
// ─────────────────────────────────────────────────────────────────────────────

export interface Vente {
    nom: string
    prix: number
}

export interface Recherche {
    nom: string
    quantite: number
    prix?: number
}

export interface FicheAppro {
    vendDeja: Vente[]
    recherche: Recherche[]
    boutiqueType?: ""
    surface?: string | number
    plateformes?: string[]
    localisationType?: ""
    activiteType?: string
    vintage?: boolean
    vintageDepuis?: string
    budget: number
    approvisionnement?: string
    canalVente?: string
    budgetRange?: string
    budgetValid?: boolean
    type?: string[] | string
    ville?: string
    pays?: string
    Horizon?: string
    collum?: number
    besoinsHomme?: string[]
    besoinsFemme?: string[]
    Note: string
    evaluationRange: number[]
    marques: string[]
    Matiere?: string[]
    provenance?: string
    experience?: string
    /** Langue de communication du client (switch FR/EN de la fiche brief). */
    language?: "FR" | "EN"
}

// ─────────────────────────────────────────────────────────────────────────────
// Fiche client
// ─────────────────────────────────────────────────────────────────────────────

export interface Client {
    customer?: Owner | null
    id?: string
    nom: string | null
    societe: string | null
    telephone: string | null
    telephone_2?: string | null
    mail: string | null
    mail_2?: string | null
    siret: string | null
    localisation: string | null
    commandes?: string | null
    depense?: number | null
    collum?: number | null
    brief?: FicheAppro | string | null
    insta?: string | null
    updated_at?: string | null
    prise_en_charge?: string | null
    created_at?: string | null
    message?: string | null
    /** Urgence déclarée au formulaire de contact, recopiée depuis le lead. */
    urgency?: string | null
    closers?: Owner | null
    adresse_livraison?: string[] | string
    adresse_facturation?: { address: string; label?: string }[]
    numero_TVA?: string | null
    /** Opt-in newsletter clients (false par défaut). */
    newsletter?: boolean
    /** Dernière bascule de l'opt-in (consentement / désinscription). */
    newsletter_updated_at?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtres et regroupement Kanban
// ─────────────────────────────────────────────────────────────────────────────

/** Onglet actif du board Kanban (acquisition vs fidélisation). */
export type ActiveTab = "acquisition" | "fidelisation"

/** Statut de la prochaine tâche d'un client (pour le badge couleur). */
export type TaskStatus = "green" | "red" | "gray" | "notask" | "none"

export interface ClientFilters {
    user: string
    date: "all" | "1d" | "3d" | "1w" | "1m"
    experience: "all" | "low" | "mid" | "high"
    task: "all" | "with" | "without"
}

export interface FilterInput {
    searchTerm: string
    filters: ClientFilters
    clientTaskMap: Map<string, TaskStatus>
    visibleColsIndices: number[]
}

/** Structure de données renvoyée par `groupAndSortBoard`. */
export interface BoardData {
    groups: Record<string, Client[]>
    visibleCols: string[]
}
