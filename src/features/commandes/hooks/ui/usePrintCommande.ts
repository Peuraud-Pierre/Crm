import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { useQrDataUrls } from "@/shared/hooks/useQrDataUrls"
import { printHtmlDocument } from "@/shared/utils/qrLabelSheet"
import {
    bordereauHtml,
    cartonLabelSheetHtml,
    labelTexts,
    paletteLabelSheetHtml,
} from "@/features/commandes/utils/commandeLabels"
import type { Carton, LivraisonBoutique, Palette } from "@/features/commandes/types/commande.types"

/**
 * Impression des documents d'une livraison : étiquettes cartons, étiquettes
 * palettes, bordereau. Les QR sont générés à l'avance (une fois par code) :
 * `ready` reste faux tant qu'ils ne le sont pas.
 */
export function usePrintCommande(livraison: LivraisonBoutique | null, palettes: readonly Palette[], cartons: readonly Carton[]) {
    const texts = useMemo(() => (livraison ? labelTexts(livraison, palettes, cartons) : []), [livraison, palettes, cartons])
    const qrs = useQrDataUrls(texts)
    const ready = texts.length > 0 && texts.every((t) => qrs.has(t))
    const qr = useCallback((text: string) => qrs.get(text) ?? null, [qrs])

    const print = useCallback((html: string) => {
        if (!printHtmlDocument(html)) toast.error("Fenêtre d'impression bloquée : autorisez les pop-ups pour ce site.")
    }, [])

    return {
        ready,
        printCartons: () => livraison && print(cartonLabelSheetHtml(livraison, cartons, qr)),
        printPalettes: () => livraison && print(paletteLabelSheetHtml(livraison, palettes, cartons, qr)),
        printBordereau: () => livraison && print(bordereauHtml(livraison, palettes, cartons)),
    }
}
