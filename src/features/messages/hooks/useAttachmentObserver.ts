import { useCallback, useEffect, useRef } from "react"
import type { RefObject } from "react"

/**
 * Déclenche le chargement d'une pièce jointe quand sa bulle approche de
 * l'écran.
 *
 * Extrait de `MessageList`, qui dépassait le seuil de 400 lignes de
 * CLAUDE.md. Deux pièges sont traités ici, et c'est la raison d'être du hook :
 *
 * - **un seul observateur pour toute la liste**, jamais un par ligne, sinon on
 *   crée autant d'abonnements que de messages (DESIGN_SYSTEM.md §13.5) ;
 * - **les refs de rappel s'exécutent au commit, avant le `useEffect`** qui
 *   crée l'observateur : sans le sas `pendingNodesRef`, la première page se
 *   réclamerait en entier au montage et le chargement paresseux ne servirait
 *   à rien.
 */
export function useAttachmentObserver({
    scrollContainerRef,
    onRequestAttachment,
}: {
    scrollContainerRef?: RefObject<HTMLDivElement | null>
    onRequestAttachment?: (messageId: number) => void
}) {
const attachmentObserverRef = useRef<IntersectionObserver | null>(null)
const pendingNodesRef = useRef<Set<HTMLElement>>(new Set())
const onRequestAttachmentRef = useRef(onRequestAttachment)
onRequestAttachmentRef.current = onRequestAttachment

const requestFromNode = useCallback((node: HTMLElement) => {
    const raw = node.dataset.attachmentId
    const id = raw ? Number(raw) : Number.NaN
    if (!Number.isNaN(id)) onRequestAttachmentRef.current?.(id)
}, [])

useEffect(() => {
    const nodes = pendingNodesRef.current
    if (typeof IntersectionObserver === "undefined") {
        // jsdom, navigateur ancien : charger tout de suite plutôt que
        // jamais. Le comportement retombe sur celui d'avant.
        for (const node of nodes) requestFromNode(node)
        nodes.clear()
        return
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue
                const node = entry.target as HTMLElement
                requestFromNode(node)
                // Une pièce jointe ne se réclame qu'une fois.
                observer.unobserve(node)
                pendingNodesRef.current.delete(node)
            }
        },
        {
            root: scrollContainerRef?.current ?? null,
            // Précharge juste avant l'entrée à l'écran : l'utilisateur ne
            // voit pas le squelette s'il fait défiler à vitesse normale.
            rootMargin: "600px 0px",
        }
    )
    attachmentObserverRef.current = observer
    // Rattrape les nœuds montés avant la création de l'observateur.
    for (const node of nodes) observer.observe(node)

    return () => {
        observer.disconnect()
        attachmentObserverRef.current = null
    }
}, [scrollContainerRef, requestFromNode])

const observeAttachment = useCallback(
    (node: HTMLDivElement | null) => {
        if (!node) return
        if (typeof IntersectionObserver === "undefined") {
            requestFromNode(node)
            return
        }
        pendingNodesRef.current.add(node)
        attachmentObserverRef.current?.observe(node)
        // Nettoyage de ref (React 19) : sans lui, chaque bulle démontée
        // (pagination, changement de conversation) resterait dans le Set.
        return () => {
            pendingNodesRef.current.delete(node)
            attachmentObserverRef.current?.unobserve(node)
        }
    },
    [requestFromNode]
)

    return { observeAttachment }
}
