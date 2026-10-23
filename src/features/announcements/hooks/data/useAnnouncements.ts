import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    deleteAnnouncement,
    fetchAnnouncements,
    insertAnnouncement,
    setAnnouncementArchived,
    updateAnnouncement,
} from "../../services/announcementService"
import type {
    Announcement,
    AnnouncementDraft,
} from "../../types/announcement.types"

/**
 * Orchestration des annonces.
 *
 * Remplace `features/manager/hooks/Manager_hook/useAnnonce.ts`, dont les
 * cinq opérations répétaient le même bloc try/catch/toast et exposaient à
 * la fois `fetchAnnonce`, `reftech` (sic) et aucun `refetch`.
 *
 * Ce hook n'est PAS monté dans un provider global. L'ancien l'était :
 * chaque utilisateur chargeait toutes les annonces à l'ouverture de
 * l'application, même sur une page qui n'en affiche aucune. Ici, ce sont
 * les consommateurs (widget du dashboard, console d'administration) qui
 * le montent quand ils en ont besoin.
 */
export function useAnnouncements() {
    const { user } = useAuth()
    // Identifiant plutôt que l'objet `user` : une nouvelle référence à
    // chaque rendu du provider relancerait le chargement en boucle.
    const userId = user?.user_id

    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [loading, setLoading] = useState(true)

    // Garde dernier-arrivé-gagnant (motif de usePermissions.ts).
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const rows = await fetchAnnouncements()
            if (requestIdRef.current !== requestId) return
            setAnnouncements(rows)
        } catch (err) {
            console.error("[useAnnouncements] refetch:", err)
            toast.error("Erreur lors du chargement des annonces")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!userId) return
        void refetch()
    }, [userId, refetch])

    /**
     * Fabrique une opération d'écriture : même traitement d'erreur pour
     * les quatre mutations, et rechargement après succès. Évite les
     * quatre blocs try/catch identiques de l'ancien hook.
     */
    const mutate = useCallback(
        async (
            label: string,
            operation: () => Promise<void>,
            successMessage?: string
        ): Promise<boolean> => {
            try {
                await operation()
                await refetch()
                if (successMessage) toast.success(successMessage)
                return true
            } catch (err) {
                console.error(`[useAnnouncements] ${label}:`, err)
                toast.error(
                    err instanceof Error
                        ? err.message
                        : `Erreur lors de l'opération : ${label}`
                )
                return false
            }
        },
        [refetch]
    )

    const create = useCallback(
        (draft: AnnouncementDraft) =>
            mutate("create", () => insertAnnouncement(draft), "Annonce créée"),
        [mutate]
    )

    const edit = useCallback(
        (id: string, updates: Partial<AnnouncementDraft>) =>
            mutate(
                "edit",
                () => updateAnnouncement(id, updates),
                "Annonce modifiée"
            ),
        [mutate]
    )

    const remove = useCallback(
        (id: string) =>
            mutate("remove", () => deleteAnnouncement(id), "Annonce supprimée"),
        [mutate]
    )

    const archive = useCallback(
        (id: string, archived: boolean) =>
            mutate(
                "archive",
                () => setAnnouncementArchived(id, archived),
                archived ? "Annonce archivée" : "Annonce désarchivée"
            ),
        [mutate]
    )

    return {
        announcements,
        loading,
        refetch,
        create,
        edit,
        remove,
        archive,
    }
}
