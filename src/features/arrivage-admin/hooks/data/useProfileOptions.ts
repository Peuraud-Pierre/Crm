import { useEffect, useState } from "react"
import { fetchProfilesWithService } from "@/features/users/services/usersService"

export interface ProfileOption {
    user_id: string
    full_name: string | null
    email: string | null
}

export function useProfileOptions() {
    const [profiles, setProfiles] = useState<ProfileOption[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        fetchProfilesWithService().then(({ data, error }) => {
            if (cancelled) return
            if (!error) setProfiles((data as ProfileOption[]) ?? [])
            setLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [])

    return { profiles, loading }
}
