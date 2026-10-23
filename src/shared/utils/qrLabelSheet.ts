/**
 * Planches d'étiquettes QR imprimables, génériques.
 *
 * Même parti pris que la planche d'emplacements du handpick
 * (`stock_handpick/utils/codeLabelSheet.ts`, dont ce module est la version
 * paramétrable) : une fenêtre dédiée, parce que l'app-shell n'est pas
 * masquable proprement depuis un onglet ; du HTML autonome dimensionné en
 * millimètres, unité d'impression — Tailwind ne s'applique pas dans cette
 * fenêtre.
 */

export interface QrLabel {
    /** Code imprimé en clair sous le QR : la lecture de secours. */
    code: string
    /** Data URL du QR, ou `null` si sa génération a échoué. */
    qr: string | null
    /** Lignes de contexte sous le code, de la plus à la moins importante. */
    lines?: readonly string[]
    /** Pastille de couleur (CSS) affichée à côté du code, ex. prix au kilo. */
    swatch?: string | null
}

export interface QrLabelSheetOptions {
    /** Titre de la fenêtre d'impression. */
    title: string
    /** Étiquettes par ligne sur une page A4. */
    columns?: 2 | 3
}

export const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const style = (columns: number) => `
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; color: #111; }
  .sheet { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 4mm; }
  .label { border: 0.3mm dashed #999; border-radius: 2mm; padding: 3mm; text-align: center; break-inside: avoid; }
  .label img { width: ${columns === 2 ? 50 : 40}mm; height: ${columns === 2 ? 50 : 40}mm; }
  .code { font: 700 ${columns === 2 ? 6 : 5}mm ui-monospace, monospace; margin-top: 1mm; display: flex; align-items: center; justify-content: center; gap: 2mm; }
  .swatch { display: inline-block; width: 4mm; height: 4mm; border-radius: 50%; border: 0.3mm solid #333; }
  .line { font-size: 3.2mm; color: #333; margin-top: 0.6mm; }
  .line + .line { color: #666; }
`

export function buildQrLabelSheetHtml(labels: readonly QrLabel[], options: QrLabelSheetOptions): string {
    const columns = options.columns ?? 3
    const items = labels
        .map((label) => {
            const img = label.qr ? `<img src="${escapeHtml(label.qr)}" alt="" />` : ""
            const swatch = label.swatch
                ? `<span class="swatch" style="background:${escapeHtml(label.swatch)}"></span>`
                : ""
            const lines = (label.lines ?? [])
                .filter(Boolean)
                .map((line) => `<div class="line">${escapeHtml(line)}</div>`)
                .join("")
            return `<div class="label">${img}<div class="code">${swatch}${escapeHtml(label.code)}</div>${lines}</div>`
        })
        .join("")
    return wrapPrintDocument(options.title, style(columns), `<div class="sheet">${items}</div>`)
}

/** Document HTML autonome qui s'imprime à son chargement. */
export function wrapPrintDocument(title: string, css: string, body: string): string {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${body}<script>window.onload = () => { window.print() }</script></body></html>`
}

/** Ouvre le document et lance l'impression. `false` si le navigateur a bloqué la fenêtre. */
export function printHtmlDocument(html: string): boolean {
    const win = window.open("", "_blank")
    if (!win) return false
    win.document.write(html)
    win.document.close()
    return true
}
