import {
    createContext,
    createElement,
    type ReactNode,
    use,
    useCallback,
    useEffect,
    useState,
} from "react"
import { toast } from "sonner"
import {
    listProfilesDirectory,
    subscribeToProfilesDirectory,
    type Profile,
} from "@/shared/services/profilesService"

export type { Profile }

export interface ProfilesCtx {
    profiles: Profile[]
    loading: boolean
    fetchProfiles: () => Promise<void>
}

/**
 * Annuaire des profils en lecture seule, synchronisé en realtime.
 *
 * Les mutations (création, invitation, édition, suppression) et la gestion
 * des permissions vivent dans features/administration — ce provider ne sert
 * qu'aux features qui affichent des utilisateurs (tickets, sell-journal,
 * pingpong, galerie, tri...).
 */
export function useProfiles(): ProfilesCtx {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)

    const fetchProfiles = useCallback(async () => {
        try {
            setProfiles(await listProfilesDirectory())
        } catch (err) {
            console.error("Error fetching profiles:", err)
            toast.error("Erreur lors du chargement des utilisateurs")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchProfiles()

        // Refetch débouncé : les payloads realtime ne portent pas les
        // jointures rôle/service, on recharge la liste après 500 ms de calme.
        let timeoutId: ReturnType<typeof setTimeout>
        const unsubscribe = subscribeToProfilesDirectory(() => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => fetchProfiles(), 500)
        })

        return () => {
            unsubscribe()
            clearTimeout(timeoutId)
        }
    }, [fetchProfiles])

    return { profiles, loading, fetchProfiles }
}

const ProfilesContext = createContext<ProfilesCtx | null>(null)

export function ProfilesProvider({ children }: { children: ReactNode }) {
    const value = useProfiles()
    return createElement(ProfilesContext, { value }, children)
}

export function useProfilesCtx(): ProfilesCtx {
    const ctx = use(ProfilesContext)
    if (!ctx) {
        throw new Error("useProfilesCtx must be used under <ProfilesProvider>")
    }
    return ctx
}
