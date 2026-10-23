import XLSX from "xlsx-js-style"
import { COLUMN_NAMES } from "@/shared/utils/CrmTab"
import type { FicheAppro } from "../types"
import type { ClientExportRow } from "../services/clientService"

const HEADER_STYLE = {
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
    fill: { fgColor: { rgb: "111827" } },
    alignment: { horizontal: "center", vertical: "center" },
}

// Excel refuse toute cellule de plus de 32 767 caractères (writeFile lève
// « Text length must not exceed 32767 characters ») : on tronque avec une
// marque visible plutôt que de faire échouer tout l'export.
const MAX_CELL = 32767
const TRUNCATED = " […tronqué]"
const fit = (v: string | number) =>
    typeof v === "string" && v.length > MAX_CELL
        ? v.slice(0, MAX_CELL - TRUNCATED.length) + TRUNCATED
        : v

const json = (v: unknown) =>
    v == null ? "" : typeof v === "string" ? v : JSON.stringify(v)

const list = (v: unknown) =>
    Array.isArray(v) ? v.filter(Boolean).join(", ") : typeof v === "string" ? v : ""

const date = (v: string | null) =>
    v ? new Date(v).toLocaleString("fr-FR") : ""

// `brief` est stocké tantôt en objet, tantôt en chaîne JSON (anciennes fiches).
function parseBrief(v: unknown): Partial<FicheAppro> {
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Partial<FicheAppro>
    if (typeof v === "string") {
        try {
            const parsed: unknown = JSON.parse(v)
            if (parsed && typeof parsed === "object") return parsed as Partial<FicheAppro>
        } catch {
            // brief texte libre : pas exploitable en colonnes
        }
    }
    return {}
}

type Getter = (c: ClientExportRow, b: Partial<FicheAppro>) => string | number

const COLUMNS: { label: string; width: number; get: Getter }[] = [
    { label: "ID", width: 38, get: (c) => c.id },
    { label: "Nom", width: 24, get: (c) => c.nom ?? "" },
    { label: "Société", width: 24, get: (c) => c.societe ?? "" },
    { label: "Téléphone", width: 16, get: (c) => c.telephone ?? "" },
    { label: "Téléphone 2", width: 16, get: (c) => c.telephone_2 ?? "" },
    { label: "Mail", width: 28, get: (c) => c.mail ?? "" },
    { label: "Mail 2", width: 28, get: (c) => c.mail_2 ?? "" },
    { label: "Instagram", width: 18, get: (c) => c.insta ?? "" },
    { label: "Localisation", width: 20, get: (c) => c.localisation ?? "" },
    { label: "Adresse facturation", width: 30, get: (c) => c.adresse_facturation ?? "" },
    { label: "Adresse livraison", width: 30, get: (c) => json(c.adresse_livraison) },
    { label: "SIRET", width: 16, get: (c) => c.siret ?? "" },
    { label: "N° TVA", width: 16, get: (c) => c.numero_TVA ?? "" },
    {
        label: "Colonne",
        width: 20,
        get: (c) => (c.collum != null ? (COLUMN_NAMES[c.collum] ?? String(c.collum)) : ""),
    },
    { label: "Urgence", width: 12, get: (c) => c.urgency ?? "" },
    { label: "Gestionnaire", width: 20, get: (c) => c.customer?.full_name ?? "" },
    { label: "Closer", width: 20, get: (c) => c.closers?.full_name ?? "" },
    { label: "Prise en charge", width: 16, get: (c) => c.prise_en_charge ?? "" },
    { label: "Commandes", width: 20, get: (c) => c.commandes ?? "" },
    { label: "Dépense", width: 12, get: (c) => c.depense ?? "" },
    { label: "Message", width: 30, get: (c) => c.message ?? "" },
    // --- Brief, éclaté en colonnes ---
    { label: "Budget", width: 12, get: (_, b) => b.budget ?? "" },
    { label: "Fourchette budget", width: 16, get: (_, b) => b.budgetRange ?? "" },
    { label: "Type", width: 18, get: (_, b) => list(b.type) },
    { label: "Type boutique", width: 16, get: (_, b) => b.boutiqueType ?? "" },
    { label: "Activité", width: 16, get: (_, b) => b.activiteType ?? "" },
    { label: "Surface", width: 10, get: (_, b) => b.surface ?? "" },
    { label: "Plateformes", width: 20, get: (_, b) => list(b.plateformes) },
    { label: "Canal de vente", width: 16, get: (_, b) => b.canalVente ?? "" },
    { label: "Approvisionnement", width: 18, get: (_, b) => b.approvisionnement ?? "" },
    { label: "Ville", width: 16, get: (_, b) => b.ville ?? "" },
    { label: "Pays", width: 14, get: (_, b) => b.pays ?? "" },
    { label: "Horizon", width: 14, get: (_, b) => b.Horizon ?? "" },
    {
        label: "Vintage",
        width: 10,
        get: (_, b) => (b.vintage == null ? "" : b.vintage ? "Oui" : "Non"),
    },
    { label: "Vintage depuis", width: 14, get: (_, b) => b.vintageDepuis ?? "" },
    { label: "Expérience", width: 14, get: (_, b) => b.experience ?? "" },
    { label: "Provenance", width: 16, get: (_, b) => b.provenance ?? "" },
    { label: "Marques", width: 24, get: (_, b) => list(b.marques) },
    { label: "Matières", width: 20, get: (_, b) => list(b.Matiere) },
    { label: "Besoins homme", width: 24, get: (_, b) => list(b.besoinsHomme) },
    { label: "Besoins femme", width: 24, get: (_, b) => list(b.besoinsFemme) },
    {
        label: "Produits vendus",
        width: 30,
        get: (_, b) =>
            Array.isArray(b.vendDeja)
                ? b.vendDeja
                      .map((v) => (v.prix ? `${v.nom} (${v.prix} €)` : v.nom))
                      .join(", ")
                : "",
    },
    {
        label: "Produits recherchés",
        width: 30,
        get: (_, b) =>
            Array.isArray(b.recherche)
                ? b.recherche
                      .map((r) => (r.quantite ? `${r.nom} ×${r.quantite}` : r.nom))
                      .join(", ")
                : "",
    },
    { label: "Note brief", width: 40, get: (_, b) => b.Note ?? "" },
    { label: "Langue", width: 8, get: (_, b) => b.language ?? "" },
    { label: "Créé le", width: 18, get: (c) => date(c.created_at) },
    { label: "Mis à jour le", width: 18, get: (c) => date(c.updated_at) },
]

/** Construit et télécharge le classeur Excel de toute la base clients. */
export function downloadClientsWorkbook(clients: ClientExportRow[]) {
    const aoa = [
        COLUMNS.map((col) => col.label),
        ...clients.map((c) => {
            const brief = parseBrief(c.brief)
            return COLUMNS.map((col) => fit(col.get(c, brief)))
        }),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws["!cols"] = COLUMNS.map((col) => ({ wch: col.width }))
    ws["!freeze"] = { xSplit: 0, ySplit: 1 }
    ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: aoa.length - 1, c: COLUMNS.length - 1 },
        }),
    }
    COLUMNS.forEach((_, c) => {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
        if (cell) cell.s = { ...HEADER_STYLE }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Clients")
    const today = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `base_clients_crm_${today}.xlsx`)
}
