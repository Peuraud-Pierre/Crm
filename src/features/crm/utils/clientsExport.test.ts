import { afterEach, describe, expect, rstest, test } from "@rstest/core"
import XLSX from "xlsx-js-style"
import type { ClientExportRow } from "../services/clientService"
import { downloadClientsWorkbook } from "./clientsExport"

const client = (over: Partial<ClientExportRow> = {}) =>
    ({
        id: "c1",
        nom: "Dupont",
        customer: { id: "p1", user_id: "u1", full_name: "Alice" },
        closers: null,
        collum: 4,
        brief: null,
        ...over,
    }) as ClientExportRow

// Intercepte writeFile et sérialise réellement le classeur (XLSX.write)
// pour que les erreurs de l'encodeur — dont la limite 32 767 — remontent.
function exportRows(rows: ClientExportRow[]) {
    let sheet: XLSX.WorkSheet | undefined
    rstest.spyOn(XLSX, "writeFile").mockImplementation((wb: XLSX.WorkBook) => {
        XLSX.write(wb, { type: "array", bookType: "xlsx" })
        sheet = wb.Sheets.Clients
    })
    downloadClientsWorkbook(rows)
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!)
}

afterEach(() => rstest.restoreAllMocks())

describe("downloadClientsWorkbook", () => {
    test("tronque une cellule au-delà de 32 767 caractères au lieu d'échouer", () => {
        const [row] = exportRows([client({ message: "x".repeat(40000) })])
        const message = row.Message as string
        expect(message.length).toBe(32767)
        expect(message.endsWith("[…tronqué]")).toBe(true)
    })

    test("éclate le brief (objet ou chaîne JSON) en colonnes", () => {
        const brief = {
            budget: 5000,
            marques: ["Levi's", "Carhartt"],
            vendDeja: [{ nom: "Jeans", prix: 20 }],
            recherche: [{ nom: "Vestes", quantite: 50 }],
        }
        const rows = exportRows([
            client({ brief }),
            client({ id: "c2", brief: JSON.stringify(brief) }),
        ])
        for (const row of rows) {
            expect(row.Budget).toBe(5000)
            expect(row.Marques).toBe("Levi's, Carhartt")
            expect(row["Produits vendus"]).toBe("Jeans (20 €)")
            expect(row["Produits recherchés"]).toBe("Vestes ×50")
        }
        expect(rows[0].Colonne).toBe("RDV Achat")
        expect(rows[0].Gestionnaire).toBe("Alice")
    })
})
