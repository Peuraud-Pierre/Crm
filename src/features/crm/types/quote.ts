/**
 * quote.ts — Devis, produits, fournisseurs et adresses
 *
 * Regroupe tout le domaine de facturation/devis :
 * lignes produit, devis complet, catalogue, fournisseurs,
 * types de produit CRM et adresses de livraison/facturation.
 */

import type { Client } from "./client"

// ─────────────────────────────────────────────────────────────────────────────
// Paiement
// ─────────────────────────────────────────────────────────────────────────────

export interface Payment {
    method: string
    amount: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Lignes de devis
// ─────────────────────────────────────────────────────────────────────────────

/** Ligne de produit telle que stockée dans le tableau d'un devis. */
export interface LigneProduit {
    id?: string
    mode: string
    name: string
    description: string
    qty: number
    price: number
    tva: number
    weight: number
    totalHT: number
    totalTVA: number
    totalTTC: number
}

/**
 * Produit affiché dans le tableau de remise d'un devis.
 * Dérivé de `LigneProduit` avec un `mode` plus strict.
 */
export interface QuoteProduct {
    id: string
    name: string
    description: string
    qty: number
    weight: number
    price: number
    tva: number
    totalHT: number
    totalTVA: number
    totalTTC: number
    mode: "Kilo" | "Pièce" | "Remise"
}

// ─────────────────────────────────────────────────────────────────────────────
// Devis
// ─────────────────────────────────────────────────────────────────────────────

export type UrgenceLevel = "normale" | "haute" | "élevée"

export interface Devis {
    id?: string
    name?: string | null
    by?: string | null
    client: string | null
    urgence?: UrgenceLevel | null
    Date_crea?: string | null
    Date_end?: string | null
    Tableau?: LigneProduit[]
    Tableau_id?: string | null
    paiement?: Payment[]
    Remise?: QuoteProduct[] | null
    poid?: number | null
    poid_balance?: number | null
    totalHT?: number | null
    totalTVA?: number | null
    totalTTC?: number | null
    TVA?: number | null
    Avoir?: number | null
    termes?: string | null
    status?: string | null
    service?: string | null
    Livraison?: string | null
    montantPaye?: number | null
    Archive?: boolean | null
    /** Profil du créateur du devis (jointure). */
    profiles?: {
        id: string
        user_id: string
        full_name?: string | null
        email?: string | null
    } | null
    /** Fiche client liée (jointure). */
    client_crm?: Client | null
}

/**
 * Ligne brute d'un tableau de devis telle que renvoyée par Supabase.
 * Utilisée lors du mapping DB → Devis.
 */
export interface DevisTableau {
    id_tab: number
    id: string
    number: number | null
    produit: string | null
    description: string | null
    qty: number | null
    poid: number | null
    prix: number | null
    totalHT: number | null
    TVA: number | null
    mode: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue produits
// ─────────────────────────────────────────────────────────────────────────────

export interface Product {
    id?: number
    name: string
    type?: string
    price: number
    stock: number
    categorie: string
    sales?: number
    description?: string
    mode?: string
    tva?: number
    facturation?: string
    weight?: number
    fournisseur?: {
        id: string
        name: string
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fournisseurs
// ─────────────────────────────────────────────────────────────────────────────

export interface Fournisseur {
    id?: string
    name: string
    tag?: string
    unit_price?: number
    unit_weight?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Types produit CRM
// ─────────────────────────────────────────────────────────────────────────────

/** Catégorie/type de produit CRM (table `Type_product_CRM`). */
export interface Type_CRM {
    id?: string
    name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Adresses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entrée dans la liste des adresses sauvegardées du formulaire devis.
 * `removable: false` pour les adresses de la fiche client (non supprimables).
 */
export interface AddressItem {
    value: string
    label: string
    removable: boolean
}
