import { useEffect, useState } from "react"
import { listMfaFactors } from "@/features/auth/services/authService"
import type { Factor } from "@supabase/supabase-js"

type MfaEnrolledState = {
    enrolled: boolean | null
    loading: boolean
    refetch: () => Promise<void>
}

export function useMfaEnrolled(userId: string | undefined): MfaEnrolledState {
    const [enrolled, setEnrolled] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(true)

    const fetch = async () => {
        setLoading(true)
        try {
            const { data, error } = await listMfaFactors()
            if (error) {
                setEnrolled(false)
                return
            }
            const hasVerifiedTotp =
                data?.all?.some(
                    (f: Factor) =>
                        f.factor_type === "totp" && f.status === "verified"
                ) ?? false
            setEnrolled(hasVerifiedTotp)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!userId) {
            // Resync de l'état sur changement d'entité (userId absent) : reset contrôlé.
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setEnrolled(null)
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setLoading(false)
            return
        }
        void fetch()
    }, [userId])

    return { enrolled, loading, refetch: fetch }
}
