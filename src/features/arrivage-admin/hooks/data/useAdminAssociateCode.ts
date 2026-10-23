import { useState } from "react"
import { toast } from "sonner"
import { adminSubscribeUser } from "@/features/arrivage-admin/services/newsletterService"

export function useAdminAssociateCode() {
    const [associating, setAssociating] = useState(false)

    const associateCode = async (
        code: string,
        profile: { user_id: string; email: string; full_name: string | null }
    ): Promise<boolean> => {
        setAssociating(true)
        try {
            await adminSubscribeUser({
                user_id: profile.user_id,
                email: profile.email,
                full_name: profile.full_name,
                invitation_code: code,
            })
            toast.success("Utilisateur associé au code.")
            return true
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
            return false
        } finally {
            setAssociating(false)
        }
    }

    return { associating, associateCode }
}
