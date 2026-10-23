import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { useQrDataUrls } from "./useQrDataUrls"
import { emplacementCodeUrl } from "@/features/stock_handpick/utils/emplacementCode"
import { printLabelSheet } from "@/features/stock_handpick/utils/codeLabelSheet"
import type { CodeItem } from "@/features/stock_handpick/utils/emplacementGroups"

/**
 * QR des étiquettes sélectionnées et impression de la planche. Un seul appel
 * par onglet : le panneau latéral et la barre mobile partagent le même état.
 */
export function usePrintLabels(items: CodeItem[]) {
    const texts = useMemo(
        () => items.map((item) => emplacementCodeUrl(window.location.origin, item.id)),
        [items],
    )
    const qrs = useQrDataUrls(texts)
    const ready = items.length > 0 && texts.every((text) => qrs.has(text))

    /** QR de l'item d'indice `i` : data URL, `null` si échec, `undefined` en cours. */
    const qrAt = useCallback((i: number) => qrs.get(texts[i]), [qrs, texts])

    const print = useCallback(() => {
        const labels = items.map((item, i) => ({ path: item.path, zoneLabel: item.zoneLabel, qr: qrAt(i) ?? null }))
        if (labels.some((label) => label.qr === null)) {
            toast.error("Certains QR n'ont pas pu être générés : leur étiquette n'aura que le chemin.")
        }
        if (!printLabelSheet(labels)) {
            toast.error("Fenêtre d'impression bloquée : autorisez les pop-ups pour ce site.")
        }
    }, [items, qrAt])

    return { ready, qrAt, print }
}
