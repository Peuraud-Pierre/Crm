import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import { type FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"

/**
 * Brouillon local du brief client.
 *
 * Le brouillon était écrit à chaque frappe mais jamais relu : le filet
 * existait sans rien rattraper. Il sert désormais après un rechargement
 * inopiné (déploiement, crash, onglet fermé) survenu avant que la sauvegarde
 * debouncée n'ait atteint la base.
 *
 * La restauration n'est jamais automatique : elle est proposée. Réinjecter
 * silencieusement un brouillon écraserait les modifications faites entre-temps
 * depuis un autre poste, sans que personne ne le voie passer.
 */

const KEY_PREFIX = "fiche_client_"

/**
 * Au-delà, le brouillon est considéré comme périmé et n'est plus proposé :
 * restaurer une saisie vieille de plusieurs jours par-dessus des données
 * serveur à jour serait presque toujours une erreur.
 */
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000

type StoredDraft = { savedAt: number; fiche: FicheAppro }

export function draftKey(customerId: string): string {
    return `${KEY_PREFIX}${customerId}`
}

/**
 * Écrit le brouillon et purge ceux des autres clients, pour tenir dans le
 * quota. Les échecs sont avalés : un quota plein ne doit pas casser la saisie.
 */
export function writeDraft(key: string, fiche: FicheAppro): void {
    try {
        const stale: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k?.startsWith(KEY_PREFIX) && k !== key) stale.push(k)
        }
        stale.forEach((k) => localStorage.removeItem(k))

        const payload: StoredDraft = { savedAt: Date.now(), fiche }
        localStorage.setItem(key, JSON.stringify(payload))
    } catch (error) {
        console.error(
            "Impossible de sauvegarder localement, le cache est totalement plein.",
            error
        )
    }
}

export function clearDraft(key: string): void {
    try {
        localStorage.removeItem(key)
    } catch {
        // Stockage indisponible : rien à nettoyer de toute façon.
    }
}

/**
 * Lit un brouillon exploitable, ou null.
 *
 * Les brouillons au format antérieur (fiche brute, sans `savedAt`) sont
 * ignorés : sans date, impossible de dire s'ils sont plus récents que le
 * serveur, et les proposer reviendrait à jouer à pile ou face.
 */
export function readDraft(key: string): StoredDraft | null {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null

        const parsed = JSON.parse(raw) as unknown
        if (
            !parsed ||
            typeof parsed !== "object" ||
            !("savedAt" in parsed) ||
            typeof (parsed as StoredDraft).savedAt !== "number" ||
            !("fiche" in parsed)
        ) {
            return null
        }

        const draft = parsed as StoredDraft
        if (Date.now() - draft.savedAt > MAX_DRAFT_AGE_MS) return null
        return draft
    } catch {
        return null
    }
}

/**
 * Propose la restauration d'un brouillon plus complet que ce que le serveur a
 * renvoyé, une seule fois par client.
 *
 * @param customerId client courant, null tant qu'aucun n'est ouvert.
 * @param serverFiche brief tel que renvoyé par le serveur, null tant qu'il charge.
 * @param onRestore appelé si l'utilisateur accepte.
 */
export function useBriefDraftRecovery({
    customerId,
    serverFiche,
    onRestore,
}: {
    customerId: string | null
    serverFiche: FicheAppro | null
    onRestore: (fiche: FicheAppro) => void
}): void {
    // Une seule proposition par client : sans ce garde, chaque écho Realtime
    // relancerait le toast.
    const offeredForRef = useRef<string | null>(null)
    const onRestoreRef = useRef(onRestore)
    onRestoreRef.current = onRestore

    const restore = useCallback((key: string, fiche: FicheAppro) => {
        onRestoreRef.current(fiche)
        clearDraft(key)
    }, [])

    useEffect(() => {
        if (!customerId || !serverFiche) return
        if (offeredForRef.current === customerId) return

        const key = draftKey(customerId)
        const draft = readDraft(key)
        if (!draft) return

        offeredForRef.current = customerId

        // Brouillon identique au serveur : la sauvegarde était bien passée,
        // il n'y a rien à récupérer.
        if (JSON.stringify(draft.fiche) === JSON.stringify(serverFiche)) {
            clearDraft(key)
            return
        }

        toast("Saisie non enregistrée retrouvée", {
            description:
                "Des modifications de ce brief n'ont pas été enregistrées avant la fermeture de la page.",
            duration: 15000,
            action: {
                label: "Restaurer",
                onClick: () => restore(key, draft.fiche),
            },
            cancel: {
                label: "Ignorer",
                onClick: () => clearDraft(key),
            },
        })
    }, [customerId, serverFiche, restore])
}
