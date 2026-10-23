import { useCallback, useState } from "react"
import {
    PACKING_ACCEPTED_EXTENSIONS,
    PACKING_MAX_FILE_MB,
} from "@/features/stock/constants"
import {
    importPackingList,
    PackingImportError,
} from "@/features/stock/services/packingImportService"
import type { PackingImportResult } from "@/features/stock/types/packing-list.types"

/**
 * Étape LOCALE de l'import.
 *
 * `sending` couvre l'envoi ET le traitement synchrone de Go : `fetch` ne dit
 * pas quand l'envoi se termine, découper en deux étapes chronométrées aurait
 * été une animation mensongère. Le traitement asynchrone, lui, n'est pas un
 * état local : il se lit sur le statut `en_traitement` de la packing en base,
 * qui survit à la fermeture de la sheet.
 */
export type PackingImportStep = "idle" | "sending" | "error"

/** Refus d'un fichier AVANT tout envoi, ou `null` s'il est recevable. */
export function validatePackingFile(file: File): string | null {
    const name = file.name.toLowerCase()
    if (!PACKING_ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        return `Format non pris en charge : déposez un fichier ${PACKING_ACCEPTED_EXTENSIONS.join(" ou ")}.`
    }
    if (file.size > PACKING_MAX_FILE_MB * 1024 * 1024) {
        return `Fichier trop volumineux (${PACKING_MAX_FILE_MB} Mo maximum).`
    }
    if (file.size === 0) {
        return "Le fichier est vide."
    }
    return null
}

interface UsePackingImportOptions {
    arrivageId: string
    /** Appelé dès que le brouillon existe en base, quel que soit son statut. */
    onImported: (result: PackingImportResult) => void | Promise<void>
}

export function usePackingImport({ arrivageId, onImported }: UsePackingImportOptions) {
    const [step, setStep] = useState<PackingImportStep>("idle")
    const [error, setError] = useState<string | null>(null)
    const [file, setFile] = useState<File | null>(null)

    const start = useCallback(
        async (candidate: File) => {
            const refusal = validatePackingFile(candidate)
            setFile(candidate)
            if (refusal) {
                setError(refusal)
                setStep("error")
                return
            }

            setError(null)
            setStep("sending")
            try {
                const result = await importPackingList(candidate, arrivageId)
                // L'étape ne retombe qu'APRÈS le rechargement de la synthèse :
                // dans l'autre ordre, la zone de dépôt réapparaîtrait le temps
                // que la packing fraîchement créée arrive.
                await onImported(result)
                setStep("idle")
            } catch (err) {
                console.error("[usePackingImport]", err)
                setError(
                    err instanceof PackingImportError
                        ? err.message
                        : "L'import a échoué. Vérifiez le fichier et réessayez.",
                )
                setStep("error")
            }
        },
        [arrivageId, onImported],
    )

    const reset = useCallback(() => {
        setStep("idle")
        setError(null)
        setFile(null)
    }, [])

    return { step, error, file, start, reset, busy: step === "sending" }
}
