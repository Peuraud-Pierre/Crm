import { useCallback, useEffect, useState } from "react"
import {
    fetchAmeliaSubmissions,
    type AmeliaSubmission,
} from "@/features/crm/services/ameliaSubmissionsService"

export type { AmeliaSubmission } from "@/features/crm/services/ameliaSubmissionsService"

export function useAmeliaSubmissions(clientId?: string) {
    const [submissions, setSubmissions] = useState<AmeliaSubmission[]>([])
    const [loading, setLoading] = useState(false)

    const fetchSubmissions = useCallback(async () => {
        if (!clientId) {
            setSubmissions([])
            return
        }
        setLoading(true)
        try {
            const data = await fetchAmeliaSubmissions(clientId)
            setSubmissions(data)
        } catch (err) {
            if (process.env.NODE_ENV !== "production") {
                console.warn("[CRM] useAmeliaSubmissions:", err)
            }
            setSubmissions([])
        } finally {
            setLoading(false)
        }
    }, [clientId])

    useEffect(() => {
        void fetchSubmissions()
    }, [fetchSubmissions])

    return { submissions, loading, refresh: fetchSubmissions }
}
