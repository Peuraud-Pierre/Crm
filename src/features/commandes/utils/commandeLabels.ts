import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
    buildQrLabelSheetHtml,
    escapeHtml,
    wrapPrintDocument,
    type QrLabel,
} from "@/shared/utils/qrLabelSheet"
import type { Carton, LivraisonBoutique, Palette } from "@/features/commandes/types/commande.types"
import { formatPaletteCode } from "./commandeCode"

/**
 * Documents imprimés de la salle de commande.
 *
 *   étiquette CARTON  : la catégorie et le poids en gros, lisibles de loin ;
 *                       le QR porte le code lisible du carton
 *                       (`LIV-0042-C07`), répété en clair dessous pour la
 *                       saisie de secours. C'est ce que la boutique scanne.
 *   étiquette PALETTE : son code et la liste de ses cartons.
 *   BORDEREAU         : une page A4 par livraison, à signer à la réception.
 */

const kg = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`

/** Textes à encoder en QR pour une livraison : cartons puis palettes. */
export function labelTexts(livraison: LivraisonBoutique, palettes: readonly Palette[], cartons: readonly Carton[]): string[] {
    return [...cartons.map((c) => c.code), ...palettes.map((p) => formatPaletteCode(livraison.numero, p.numero))]
}

export function cartonLabels(
    livraison: LivraisonBoutique,
    cartons: readonly Carton[],
    qr: (text: string) => string | null,
): QrLabel[] {
    return cartons.map((c, i) => ({
        code: c.code,
        qr: qr(c.code),
        lines: [
            `${c.category_nom} — ${kg(c.poids_kg_prevu)}`,
            `${livraison.boutique_nom} · carton ${i + 1}/${cartons.length}`,
            c.palette_code ? `Palette ${c.palette_code}` : "Hors palette",
        ],
    }))
}

export function paletteLabels(
    livraison: LivraisonBoutique,
    palettes: readonly Palette[],
    cartons: readonly Carton[],
    qr: (text: string) => string | null,
): QrLabel[] {
    return palettes.map((p) => {
        const code = formatPaletteCode(livraison.numero, p.numero)
        const contenu = cartons.filter((c) => c.palette_id === p.id)
        return {
            code,
            qr: qr(code),
            lines: [
                `${livraison.boutique_nom} · palette ${p.numero}/${palettes.length}`,
                `${contenu.length} carton${contenu.length > 1 ? "s" : ""} · ${kg(contenu.reduce((s, c) => s + c.poids_kg_prevu, 0))}`,
                contenu.map((c) => `C${String(c.numero).padStart(2, "0")}`).join(" "),
            ],
        }
    })
}

export function cartonLabelSheetHtml(livraison: LivraisonBoutique, cartons: readonly Carton[], qr: (t: string) => string | null): string {
    return buildQrLabelSheetHtml(cartonLabels(livraison, cartons, qr), { title: `Étiquettes ${livraison.code}`, columns: 2 })
}

export function paletteLabelSheetHtml(
    livraison: LivraisonBoutique,
    palettes: readonly Palette[],
    cartons: readonly Carton[],
    qr: (t: string) => string | null,
): string {
    return buildQrLabelSheetHtml(paletteLabels(livraison, palettes, cartons, qr), { title: `Palettes ${livraison.code}`, columns: 2 })
}

const BORDEREAU_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #111; font-size: 3.4mm; }
  h1 { font-size: 7mm; margin: 0; font-family: ui-monospace, monospace; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; border-bottom: 0.4mm solid #111; padding-bottom: 4mm; }
  .meta { color: #444; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-top: 5mm; }
  th { text-align: left; font-size: 2.8mm; text-transform: uppercase; color: #555; border-bottom: 0.3mm solid #999; padding: 1.5mm; }
  td { border-bottom: 0.2mm solid #ddd; padding: 1.6mm; vertical-align: top; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  .pal { background: #f3f4f6; font-weight: 700; }
  .box { width: 5mm; height: 5mm; border: 0.3mm solid #333; display: inline-block; }
  .tot { margin-top: 4mm; text-align: right; font-weight: 700; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 12mm; }
  .sign div { border-top: 0.3mm solid #111; padding-top: 2mm; color: #444; height: 22mm; }
`

/**
 * Bordereau de livraison : la liste de ce qui part, par palette, avec une case
 * à cocher par carton. C'est la version papier de l'écran de réception, pour
 * le cas où la boutique n'a pas de téléphone sous la main.
 */
export function bordereauHtml(livraison: LivraisonBoutique, palettes: readonly Palette[], cartons: readonly Carton[]): string {
    const groupes = [
        ...palettes.map((p) => ({ titre: `Palette ${formatPaletteCode(livraison.numero, p.numero)}`, cartons: cartons.filter((c) => c.palette_id === p.id) })),
        { titre: "Hors palette", cartons: cartons.filter((c) => !c.palette_id) },
    ].filter((g) => g.cartons.length > 0)

    const rows = groupes.map((g) => `
        <tr class="pal"><td colspan="4">${escapeHtml(g.titre)} — ${g.cartons.length} carton(s), ${kg(g.cartons.reduce((s, c) => s + c.poids_kg_prevu, 0))}</td></tr>
        ${g.cartons.map((c) => `<tr>
            <td style="font-family: ui-monospace, monospace">${escapeHtml(c.code)}</td>
            <td>${escapeHtml(c.category_nom)}</td>
            <td class="n">${kg(c.poids_kg_prevu)}</td>
            <td><span class="box"></span></td>
        </tr>`).join("")}`).join("")

    const dateExp = livraison.expediee_at ?? livraison.date_expedition_prevue
    const body = `
        <div class="head">
            <div>
                <h1>${escapeHtml(livraison.code)}</h1>
                <div class="meta">Bordereau de livraison${livraison.commande_code ? ` · commande ${escapeHtml(livraison.commande_code)}` : ""}</div>
            </div>
            <div class="meta" style="text-align:right">
                <strong>${escapeHtml(livraison.boutique_nom)}</strong> (${escapeHtml(livraison.boutique_code)})<br>
                Expédition : ${dateExp ? escapeHtml(format(new Date(dateExp), "EEEE d MMMM yyyy", { locale: fr })) : "—"}<br>
                ${palettes.length} palette(s) · ${cartons.length} carton(s)
            </div>
        </div>
        <table>
            <thead><tr><th>Carton</th><th>Catégorie</th><th style="text-align:right">Poids brut</th><th>Reçu</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="tot">Total : ${kg(cartons.reduce((s, c) => s + c.poids_kg_prevu, 0))}</div>
        <div class="sign"><div>Expédié par (nom, signature)</div><div>Reçu par (nom, date, signature)</div></div>`
    return wrapPrintDocument(`Bordereau ${livraison.code}`, BORDEREAU_CSS, body)
}
