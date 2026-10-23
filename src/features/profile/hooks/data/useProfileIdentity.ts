import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    updateProfileIdentity,
    uploadProfileAvatar,
} from "../../services/profileService"
import type { ProfileIdentityInput } from "../../types"

/**
 * Mutations du profil de l'utilisateur courant (identité + photo).
 * Aucune lecture : le profil est déjà porté par le contexte d'auth. Après
 * écriture, `setUser` propage la valeur pour que le header global et la
 * page reflètent le changement sans rechargement.
 */
export function useProfileIdentity() {
    const { user, setUser } = useAuth()
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)

    const userId = user?.user_id ?? user?.id ?? null

    const saveIdentity = useCallback(
        async (input: ProfileIdentityInput): Promise<boolean> => {
            if (!userId) return false

            setSaving(true)
            try {
                await updateProfileIdentity(userId, input)
                setUser((previous) =>
                    previous
                        ? {
                              ...previous,
                              full_name: input.full_name,
                          }
                        : previous
                )
                toast.success("Profil mis à jour.")
                return true
            } catch (err) {
                console.error("[useProfileIdentity] saveIdentity:", err)
                toast.error("Erreur lors de la mise à jour du profil")
                return false
            } finally {
                setSaving(false)
            }
        },
        [userId, setUser]
    )

    const uploadAvatar = useCallback(
        async (file: File): Promise<boolean> => {
            if (!userId) return false

            if (!file.type.startsWith("image/")) {
                toast.error("Veuillez sélectionner une image.")
                return false
            }

            setUploading(true)
            try {
                const publicUrl = await uploadProfileAvatar(userId, file)
                setUser((previous) =>
                    previous ? { ...previous, avatar_url: publicUrl } : previous
                )
                toast.success("Photo de profil mise à jour.")
                return true
            } catch (err) {
                console.error("[useProfileIdentity] uploadAvatar:", err)
                toast.error("Impossible de mettre à jour la photo de profil.")
                return false
            } finally {
                setUploading(false)
            }
        },
        [userId, setUser]
    )

    return { saving, uploading, saveIdentity, uploadAvatar }
}
