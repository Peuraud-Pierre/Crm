import { getAvatarPublicUrl } from "@/shared/services/avatarService"

const DEFAULT_AVATAR_BUCKET = "avatars"

export const resolveAvatarUrl = (
    avatarUrl?: string | null,
    bucket: string = DEFAULT_AVATAR_BUCKET
): string | undefined => {
    if (!avatarUrl) return undefined
    if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl

    return getAvatarPublicUrl(avatarUrl, bucket)
}
