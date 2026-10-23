import { supabase } from "@/integrations/supabase/client"
import type { Client, Payment, LigneProduit, Devis, QuoteProduct, DevisTableau } from "@/features/crm/types"

/**
 * Forme brute renvoyée par Supabase pour un devis joint (header + relations).
 */
type DevisDbRow = {
    [key: string]: unknown
    paiement?: string | Payment[] | null
    Remise?: string | QuoteProduct[] | null
    TVA?: number | null
    Avoir?: number | null
    Livraison?: string | null
    poid_balance?: number | null
    Tableau_id?: string | null
    urgence?: string | null
    client_crm?: (Client & { brief?: Client["brief"] | string }) | null
    profiles?: Devis["profiles"]
}

const safeParse = <T,>(value: unknown, fallback: T): T => {
    if (!value) return fallback
    if (typeof value === "object") return value as T
    if (typeof value !== "string") return fallback
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

function mapDevisFromDB(
    devis: DevisDbRow,
    tableauData: DevisTableau[] = []
): Devis {
    const parsedPaiement = safeParse<Payment[]>(devis.paiement, [])
    const parsedRemise = safeParse<QuoteProduct[]>(devis.Remise, [])

    let parsedClientCrm = devis.client_crm
    if (parsedClientCrm && typeof parsedClientCrm.brief === "string") {
        parsedClientCrm = {
            ...parsedClientCrm,
            brief: safeParse(parsedClientCrm.brief, ""),
        }
    }

    const products: LigneProduit[] = tableauData.map((line) => {
        const qty = line.qty ?? 0
        const price = line.prix ?? 0
        const tva =
            line.TVA !== null ? Number(line.TVA) : Number(devis.TVA) || 0
        const totalHT = qty * price
        const totalTVA = totalHT * (tva / 100)
        const totalTTC = totalHT + totalTVA

        return {
            id: line.id_tab.toString(),
            name: line.produit ?? "",
            description: line.description ?? "",
            qty,
            price,
            tva,
            weight: line.poid ?? 0,
            mode: line.mode ?? "Pièce",
            totalHT,
            totalTVA,
            totalTTC,
        }
    })

    return {
        ...devis,
        Avoir: devis.Avoir ?? 0,
        Livraison: devis.Livraison ?? "",
        poid_balance: devis.poid_balance ?? 0,
        Tableau: products,
        paiement: parsedPaiement,
        Remise: parsedRemise,
        client_crm: parsedClientCrm,
    } as Devis
}

export async function fetchOneFullDevis(devisId: string): Promise<Devis | null> {
    try {
        // 1. Header + Relations
        const { data: header, error: headerError } = await supabase
            .from("Devis")
            .select("*, profiles(*), client_crm(*)")
            .eq("id", devisId)
            .single()

        if (headerError || !header) return null

        // 2. Produits
        let tableauLines: DevisTableau[] = []
        if (header.Tableau_id) {
            const { data: lines } = await supabase
                .from("tableau_devis")
                .select("*")
                .eq("id", header.Tableau_id)
            if (lines) tableauLines = lines as DevisTableau[]
        }

        return mapDevisFromDB(header as unknown as DevisDbRow, tableauLines)
    } catch (e) {
        console.error("Error fetching single full devis", e)
        return null
    }
}

export async function createDevis(
    newDevis: Devis,
    createdBy: string | undefined
): Promise<{ id: string; Tableau_id: string | null }> {
    const remisePayload = JSON.stringify(newDevis.Remise || [])
    const paiementPayload = JSON.stringify(newDevis.paiement || [])

    const { data: createdDevis, error: insertError } = await supabase
        .from("Devis")
        .insert({
            name: newDevis.name,
            by: newDevis.by || createdBy,
            client: newDevis.client,
            Date_crea: newDevis.Date_crea,
            Date_end: newDevis.Date_end || null,
            poid: newDevis.poid ?? 0,
            poid_balance: newDevis.poid_balance ?? 0,
            totalHT: newDevis.totalHT,
            totalTVA: newDevis.totalTVA,
            totalTTC: newDevis.totalTTC,
            Avoir: newDevis.Avoir ?? 0,
            TVA: newDevis.TVA,
            termes: newDevis.termes || "",
            status: newDevis.status || "",
            service: newDevis.service,
            Livraison: newDevis.Livraison || "",
            paiement: paiementPayload,
            Remise: remisePayload,
            urgence: newDevis.urgence ?? null,
        })
        .select("id, Tableau_id")
        .single()

    if (insertError || !createdDevis)
        throw insertError || new Error("Création échouée")

    return createdDevis
}

export async function insertDevisLines(
    tableauId: string | null,
    lines: LigneProduit[]
): Promise<void> {
    if (lines.length === 0) return
    const linesToInsert = lines.map((line, index) => ({
        id: tableauId,
        number: index + 1,
        produit: line.name,
        description: line.description,
        qty: line.qty,
        poid: line.weight,
        prix: line.price,
        totalHT: line.totalHT,
        TVA: line.tva,
        mode: line.mode,
    }))

    const { error } = await supabase
        .from("tableau_devis")
        .insert(linesToInsert as never)
    if (error) throw error
}

export async function updateDevisHeader(
    devis: Devis & { id: string }
): Promise<{ Tableau_id: string | null } | null> {
    const remisePayload = JSON.stringify(devis.Remise || [])
    const paiementPayload = JSON.stringify(devis.paiement || [])

    const { data: updatedMeta, error: updateError } = await supabase
        .from("Devis")
        .update({
            name: devis.name,
            client: devis.client,
            by: devis.by,
            Date_crea: devis.Date_crea,
            Date_end: devis.Date_end,
            poid: devis.poid,
            poid_balance: devis.poid_balance,
            totalHT: devis.totalHT,
            totalTVA: devis.totalTVA,
            totalTTC: devis.totalTTC,
            Avoir: devis.Avoir ?? 0,
            termes: devis.termes,
            status: devis.status,
            service: devis.service,
            TVA: devis.TVA,
            Livraison: devis.Livraison,
            Archive: devis.Archive ?? false,
            paiement: paiementPayload,
            Remise: remisePayload,
            urgence: devis.urgence ?? null,
        })
        .eq("id", devis.id)
        .select("Tableau_id")
        .single()

    if (updateError) throw updateError
    return updatedMeta
}

export async function deleteDevisLines(tableauId: string): Promise<void> {
    const { error } = await supabase
        .from("tableau_devis")
        .delete()
        .eq("id", tableauId)
    if (error) throw error
}

export async function deleteDevis(idDevis: string): Promise<void> {
    const { error } = await supabase.from("Devis").delete().eq("id", idDevis)
    if (error) throw error
}

export async function fetchDevisByUser(info: {
    type: string
    id: string
}): Promise<Devis[]> {
    let query = supabase.from("Devis").select("*, profiles(*), client_crm(*)")

    // --- CORRECTION APPLIQUÉE ICI (Anti Erreur 42703) ---
    if (info.id !== "*") {
        const dbColumn = info.type === "user" ? "by" : info.type
        query = query.eq(dbColumn, info.id)
    }

    query = query.order("Date_crea", { ascending: false })

    const { data: devisData, error: devisError } = await query
    if (devisError) throw devisError
    if (!devisData || devisData.length === 0) return []

    // Batch fetching Products
    const tableauIds = devisData
        .map((d) => d.Tableau_id)
        .filter((id): id is string => !!id)
    let allTableauLines: DevisTableau[] = []
    if (tableauIds.length > 0) {
        const { data: lines } = await supabase
            .from("tableau_devis")
            .select("*")
            .in("id", tableauIds)
        if (lines) allTableauLines = lines as DevisTableau[]
    }

    return devisData.map((d) => {
        const relatedLines = allTableauLines.filter(
            (l) => l.id === d.Tableau_id
        )
        return mapDevisFromDB(d as unknown as DevisDbRow, relatedLines)
    })
}
