// src/modules/projects/sync/useProjectRealtime.ts
import { useCallback, useEffect, useRef } from "react"
import {
    subscribeToProjectSync,
    type ProjectSyncSubscription,
} from "@/features/projects/services/sync/projectRealtimeService"

export function useProjectRealtime(fetchBoards: () => Promise<void>) {
    const subscriptionRef = useRef<ProjectSyncSubscription | null>(null)

    useEffect(() => {
        const subscription = subscribeToProjectSync(() => {
            fetchBoards()
        })
        subscriptionRef.current = subscription

        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe()
                subscriptionRef.current = null
            }
        }
    }, [fetchBoards])

    // --------------------------------------
    // BROADCAST: allow modules to trigger sync
    // --------------------------------------
    const broadcastRefresh = useCallback(async () => {
        if (!subscriptionRef.current) return

        const result = await subscriptionRef.current.broadcastRefresh()

        if (result !== "ok") console.error("broadcastRefresh error:", result)
    }, [])

    return { broadcastRefresh }
}
