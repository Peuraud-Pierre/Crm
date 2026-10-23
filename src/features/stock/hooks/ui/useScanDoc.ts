import { useCallback, useEffect, useRef, useState } from "react"
import {
    scanDocuments,
    ScanDocError,
    type ScanDocResult,
} from "@/features/stock/services/scanDocService"
import {
    classifyScanFile,
    compressImage,
    formatBytes,
    SCAN_LIMITS,
    type ScanFileKind,
} from "@/features/stock/utils/scanFiles"

export interface ScanItem {
    id: string
    file: File
    kind: ScanFileKind
    /** URL d'aperçu des photos ; `null` pour un PDF. */
    previewUrl: string | null
}

/**
 * `preparing` : redressement et compression des photos dans le navigateur.
 * `sending` : envoi ET lecture par le modèle — `fetch` ne distingue pas les
 * deux, et la lecture prend l'essentiel du temps (une minute pour 15 pages).
 */
export type ScanStep = "idle" | "preparing" | "sending" | "done" | "error"

interface UseScanDocOptions {
    /** Injectables pour les tests : jsdom ne sait ni décoder ni dessiner. */
    compress?: (file: File) => Promise<File>
    scan?: (files: File[], signal: AbortSignal) => Promise<ScanDocResult>
    download?: (blob: Blob, filename: string) => void
}

let nextId = 0

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    // Laisse au navigateur le temps de démarrer le téléchargement.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * État de l'onglet Scan : la liste ordonnée des fichiers (l'ordre de la liste
 * est l'ordre des pages du classeur), leur envoi à scan-doc et le résultat.
 */
export function useScanDoc({
    compress = compressImage,
    scan = scanDocuments,
    download = downloadBlob,
}: UseScanDocOptions = {}) {
    const [items, setItems] = useState<ScanItem[]>([])
    const [rejected, setRejected] = useState<string[]>([])
    const [step, setStep] = useState<ScanStep>("idle")
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<ScanDocResult | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    // Les aperçus sont des URL d'objet : à libérer au retrait et au démontage.
    const itemsRef = useRef(items)
    itemsRef.current = items
    useEffect(
        () => () => {
            abortRef.current?.abort()
            for (const item of itemsRef.current) {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
            }
        },
        [],
    )

    const busy = step === "preparing" || step === "sending"

    const addFiles = useCallback(
        (files: File[]) => {
            if (busy) return
            const accepted: ScanItem[] = []
            const errors: string[] = []
            const room = SCAN_LIMITS.maxFiles - itemsRef.current.length
            for (const file of files) {
                const check = classifyScanFile(file)
                if ("error" in check) {
                    errors.push(check.error)
                } else if (accepted.length >= room) {
                    errors.push(`${file.name} : ${SCAN_LIMITS.maxFiles} fichiers au maximum.`)
                } else {
                    accepted.push({
                        id: `scan-${++nextId}`,
                        file,
                        kind: check.kind,
                        previewUrl: check.kind === "image" ? URL.createObjectURL(file) : null,
                    })
                }
            }
            setRejected(errors)
            if (accepted.length > 0) {
                setItems((prev) => [...prev, ...accepted])
                // Une nouvelle sélection rend caduc le classeur précédent.
                setResult(null)
                setError(null)
                setStep("idle")
            }
        },
        [busy],
    )

    const remove = useCallback((id: string) => {
        setItems((prev) => {
            const gone = prev.find((item) => item.id === id)
            if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
            return prev.filter((item) => item.id !== id)
        })
    }, [])

    const move = useCallback((id: string, offset: -1 | 1) => {
        setItems((prev) => {
            const from = prev.findIndex((item) => item.id === id)
            const to = from + offset
            if (from === -1 || to < 0 || to >= prev.length) return prev
            const next = [...prev]
            ;[next[from], next[to]] = [next[to], next[from]]
            return next
        })
    }, [])

    const reset = useCallback(() => {
        abortRef.current?.abort()
        for (const item of itemsRef.current) {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
        }
        setItems([])
        setRejected([])
        setResult(null)
        setError(null)
        setStep("idle")
    }, [])

    const cancel = useCallback(() => {
        abortRef.current?.abort()
        abortRef.current = null
        setStep("idle")
    }, [])

    const submit = useCallback(async () => {
        if (busy || itemsRef.current.length === 0) return
        const controller = new AbortController()
        abortRef.current = controller
        setError(null)
        setResult(null)
        setStep("preparing")

        const prepared: File[] = []
        for (const item of itemsRef.current) {
            if (item.kind === "pdf") {
                prepared.push(item.file)
                continue
            }
            try {
                prepared.push(await compress(item.file))
            } catch {
                if (controller.signal.aborted) return
                setError(`Impossible de lire ${item.file.name}. Retirez-la ou exportez-la en JPEG.`)
                setStep("error")
                return
            }
            if (controller.signal.aborted) return
        }

        const total = prepared.reduce((sum, file) => sum + file.size, 0)
        if (total > SCAN_LIMITS.maxBytes) {
            setError(
                `Envoi trop volumineux : ${formatBytes(total)} pour ${formatBytes(SCAN_LIMITS.maxBytes)} au maximum. Retirez des fichiers ou découpez le PDF.`,
            )
            setStep("error")
            return
        }

        setStep("sending")
        try {
            const res = await scan(prepared, controller.signal)
            if (controller.signal.aborted) return
            setResult(res)
            setStep("done")
            download(res.blob, res.filename)
        } catch (err) {
            if (controller.signal.aborted) return
            setError(err instanceof ScanDocError ? err.message : "Erreur inattendue pendant le scan. Réessayez.")
            setStep("error")
        } finally {
            if (abortRef.current === controller) abortRef.current = null
        }
    }, [busy, compress, scan, download])

    const downloadAgain = useCallback(() => {
        if (result) download(result.blob, result.filename)
    }, [result, download])

    return {
        items,
        rejected,
        step,
        busy,
        error,
        result,
        addFiles,
        remove,
        move,
        reset,
        cancel,
        submit,
        downloadAgain,
    }
}
