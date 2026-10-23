// src/hooks/useAuth/auth.profile.ts
import { fetchProfileByUserId } from "@/features/auth/services/authService"
import type { AppUserExtras } from "./types"

export async function fetchUserProfile(
    userId: string
): Promise<AppUserExtras | null> {
    const { data, error } = await fetchProfileByUserId(userId)

    if (error) {
        console.error("Error fetchUserProfile:", error)
        return null
    }

    data.id = userId

    return {
        ...data,
        full_name: data.full_name ?? undefined,
        avatar_url: data.avatar_url ?? undefined,
        role: data.role?.nom ?? undefined,
        role_id: data.role?.id ?? undefined,
        service: data.service?.nom ?? undefined,
        service_id: data.service?.id ?? undefined,
        last_login: data.last_login ?? undefined,
        privacy_accepted_at: data.privacy_accepted_at ?? undefined,
        privacy_accepted_version: data.privacy_accepted_version ?? undefined,
    }
}
