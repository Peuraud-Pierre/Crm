/**
 * Impression des étiquettes : une fenêtre dédiée, parce que l'app-shell
 * (sidebar, onglets) n'est pas masquable proprement depuis un onglet. La
 * planche est du HTML autonome ; ses dimensions sont en millimètres, unité
 * d'impression — hors Tailwind, qui ne s'applique pas dans cette fenêtre.
 */

export interface PrintLabel {
    path: string
    zoneLabel: string
    /** Data URL du QR, ou `null` si sa génération a échoué. */
    qr: string | null
}

/** Étiquettes par page A4 : 3 colonnes × 4 lignes (voir `STYLE`). */
export const LABELS_PER_PAGE = 12

export const labelSheetPages = (count: number) => Math.ceil(count / LABELS_PER_PAGE)

/** « 13 étiquettes · 2 pages A4 ». */
export function labelSummary(count: number): string {
    const pages = labelSheetPages(count)
    return `${count} étiquette${count > 1 ? "s" : ""} · ${pages} page${pages > 1 ? "s" : ""} A4`
}

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const STYLE = `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #111; }
  .sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .label { border: 0.3mm dashed #999; border-radius: 2mm; padding: 3mm; text-align: center; break-inside: avoid; }
  .label img { width: 40mm; height: 40mm; }
  .path { font: 700 5mm ui-monospace, monospace; margin-top: 1mm; }
  .zone { font-size: 3mm; color: #555; }
`

export function buildLabelSheetHtml(labels: PrintLabel[]): string {
    const items = labels
        .map((label) => {
            const img = label.qr ? `<img src="${escapeHtml(label.qr)}" alt="" />` : ""
            return `<div class="label">${img}<div class="path">${escapeHtml(label.path)}</div><div class="zone">${escapeHtml(label.zoneLabel)}</div></div>`
        })
        .join("")
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Étiquettes emplacements</title><style>${STYLE}</style></head><body><div class="sheet">${items}</div><script>window.onload = () => { window.print() }</script></body></html>`
}

/** Ouvre la planche et lance l'impression. `false` si le navigateur a bloqué la fenêtre. */
export function printLabelSheet(labels: PrintLabel[]): boolean {
    const win = window.open("", "_blank")
    if (!win) return false
    win.document.write(buildLabelSheetHtml(labels))
    win.document.close()
    return true
}
