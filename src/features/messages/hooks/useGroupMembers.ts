import { useCallback, useEffect, useState } from "react"
import { subscribeToGroupMembers } from "../services/groupsService"
import type { GroupMember } from "./useGroups"

/**
 * Membres du groupe sélectionné, maintenus à jour en temps réel.
 *
 * Extrait de `ChatView`, où la liste n'était rechargée que sur changement de
 * groupe : un membre ajouté pendant que la conversation était ouverte
 * n'apparaissait ni en nom ni en photo sur ses messages tant que le composant
 * n'était pas remonté.
 *
 * `loadMembers` est fourni par `useGroups` plutôt que réimplémenté ici, pour
 * garder une seule normalisation de la ligne `profiles` jointe.
 */
export function useGroupMembers(
    groupId: string | null,
    loadMembers: (groupId: string) => Promise<GroupMember[]>
): GroupMember[] {
    const [members, setMembers] = useState<GroupMember[]>([])

    const refresh = useCallback(
        async (id: string, isActive: () => boolean) => {
            const next = await loadMembers(id)
            if (isActive()) setMembers(next)
        },
        [loadMembers]
    )

    useEffect(() => {
        if (!groupId) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- reset à la déselection du groupe
            setMembers([])
            return
        }

        let active = true
        const isActive = () => active
        void refresh(groupId, isActive)

        // `useCryptedGroupChat` s'abonne déjà aux membres de ce groupe :
        // l'unicité du nom de canal est garantie par le service (voir
        // `uniqueChannelTopic`), sinon les deux abonnements se partageraient
        // une seule instance.
        //
        // Le channel ne dépend que de `groupId` : le recréer à chaque
        // changement de `members` (comme le fait useCryptedGroupChat) le
        // ferait se réabonner en boucle sur son propre résultat.
        const unsubscribe = subscribeToGroupMembers(groupId, () => {
            void refresh(groupId, isActive)
        })

        return () => {
            active = false
            unsubscribe()
        }
    }, [groupId, refresh])

    return members
}
