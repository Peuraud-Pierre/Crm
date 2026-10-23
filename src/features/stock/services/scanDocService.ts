// ── services/scanDocService.ts ────────────────────────────────────────────────
// Lecture de fiches de stock manuscrites : envoi des scans PDF et des photos au
// service `scan-doc` (Go, dépôt `scan-doc`), qui fait lire chaque page par un
// modèle de vision (OpenRouter) et renvoie un classeur Excel.
//
// CONTRAT AVEC LE SERVICE
// -----------------------
//   POST ${PUBLIC_SCAN_DOC_URL}/scan
//   Authorization: Bearer <JWT Supabase de l'utilisateur>
//   multipart/form-data : `file` répété, un par fichier, DANS L'ORDRE DES PAGES
//                         (PDF, JPEG ou PNG ; 20 Mo et 40 pages au total)
//
//   200 → le .xlsx, nom dans `Content-Disposition` (exposé par le CORS)
//   4xx/5xx { error } → message déjà rédigé en français pour l'utilisateur
//       400 format, page, fichier illisible, aucune ligne   401 jeton invalide
//       413 envoi trop lourd   502 lecture en échec   504 plus de 5 minutes
//
// La clé OpenRouter vit côté service, jamais ici : rien de ce fichier ne doit
// connaître autre chose que l'URL du service.

import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"

export class ScanDocError extends Error {
    readonly status: number | null

    constructor(message: string, status: number | null = null) {
        super(message)
        this.name = "ScanDocError"
        this.status = status
    }
}

/** Messages de repli, quand le service ne renvoie pas de `{ error }` lisible. */
const STATUS_MESSAGES: Record<number, string> = {
    401: "Session expirée — reconnectez-vous pour lancer le scan.",
    413: "Envoi trop volumineux (20 Mo au total).",
    502: "La lecture du document a échoué. Réessayez.",
    504: "Le traitement a pris trop de temps. Réessayez avec moins de pages.",
}

const DEFAULT_FILENAME = "Stock.xlsx"

export interface ScanDocResult {
    blob: Blob
    filename: string
}

/** URL du service, sans slash final. `null` quand la variable n'est pas posée. */
export function scanDocBaseUrl(): string | null {
    const raw = env.PUBLIC_SCAN_DOC_URL
    return raw ? raw.replace(/\/$/, "") : null
}

async function accessToken(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
        throw new ScanDocError(STATUS_MESSAGES[401], 401)
    }
    return session.access_token
}

/**
 * Nom de fichier d'un en-tête `Content-Disposition`. Go écrit `filename*=` en
 * UTF-8 dès que le titre lu sur la fiche n'est pas en ASCII (« Stock_Été.xlsx »).
 */
export function filenameFromDisposition(header: string | null): string {
    if (!header) return DEFAULT_FILENAME
    const extended = /filename\*\s*=\s*(?:utf-8|UTF-8)''([^;]+)/.exec(header)
    if (extended) {
        try {
            return decodeURIComponent(extended[1].trim())
        } catch {
            // Encodage invalide : on retombe sur `filename=`.
        }
    }
    const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header)
    return plain ? plain[1].trim() : DEFAULT_FILENAME
}

/** Envoie les fichiers, dans l'ordre des pages, et renvoie le classeur. */
export async function scanDocuments(files: File[], signal?: AbortSignal): Promise<ScanDocResult> {
    const baseUrl = scanDocBaseUrl()
    if (!baseUrl) {
        throw new ScanDocError("Le service de scan n'est pas configuré (PUBLIC_SCAN_DOC_URL).")
    }

    const token = await accessToken()
    const body = new FormData()
    for (const file of files) body.append("file", file, file.name)

    let response: Response
    try {
        response = await fetch(`${baseUrl}/scan`, {
            method: "POST",
            body,
            headers: { Authorization: `Bearer ${token}` },
            signal,
        })
    } catch (err) {
        if (signal?.aborted) throw err
        throw new ScanDocError("Service de scan injoignable. Réessayez dans un instant.")
    }

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: unknown }
        // Le 401 du service dit « jeton expiré » en termes techniques : le
        // message de repli parle mieux à l'utilisateur.
        const serverMessage =
            response.status !== 401 && typeof payload.error === "string" ? payload.error : null
        throw new ScanDocError(
            serverMessage ?? STATUS_MESSAGES[response.status] ?? `Erreur du service de scan (${response.status}).`,
            response.status,
        )
    }

    return {
        blob: await response.blob(),
        filename: filenameFromDisposition(response.headers.get("Content-Disposition")),
    }
}
