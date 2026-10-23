import { useEffect, useState } from "react"
import QRCode from "qrcode"

/**
 * Data URLs QR des textes donnés, générées une seule fois par texte et
 * gardées tant que l'onglet vit. Clé absente : en cours ; `null` : échec.
 */
export function useQrDataUrls(texts: readonly string[]): Map<string, string | null> {
    const [urls, setUrls] = useState<Map<string, string | null>>(() => new Map())

    useEffect(() => {
        const missing = texts.filter((text) => !urls.has(text))
        if (missing.length === 0) return
        let cancelled = false
        void Promise.all(
            missing.map((text) =>
                QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: "M" })
                    .then((url): [string, string | null] => [text, url])
                    .catch((error: unknown): [string, string | null] => {
                        console.error(error)
                        return [text, null]
                    }),
            ),
        ).then((entries) => {
            if (cancelled) return
            setUrls((prev) => new Map([...prev, ...entries]))
        })
        return () => {
            cancelled = true
        }
    }, [texts, urls])

    return urls
}
