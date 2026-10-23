import { useState, useCallback, useEffect } from "react"
import type { WatchConfig } from "../types/veille.types"
import {
    fetchWatchConfigs,
    insertWatchConfig,
    updateWatchConfig,
    updateWatchConfigServices,
    deleteWatchConfig,
} from "../services/watchConfigService"

export type { WatchConfig }

interface UseTopicsOptions {
    userServiceId?: string
}

interface UseTopicsResult {
    configs: WatchConfig[]
    loading: boolean
    error: Error | null
    createConfig: (config: Omit<WatchConfig, "id" | "created_at">, serviceIds?: string[]) => Promise<WatchConfig | null>
    updateConfig: (id: number, config: Partial<Omit<WatchConfig, "id" | "created_at">>) => Promise<WatchConfig | null>
    updateConfigServices: (id: number, serviceIds: string[] | null) => Promise<boolean>
    deleteConfig: (id: number) => Promise<boolean>
    getConfigsForService: (userId: string) => Promise<WatchConfig[]>
    refetch: () => Promise<void>
}

export const useTopics = (options?: UseTopicsOptions): UseTopicsResult => {
    const [configs, setConfigs] = useState<WatchConfig[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchConfigs = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            // Filtre par service si userServiceId est fourni :
            // une config est visible si service_ids est NULL (toutes) ou contient le service.
            const data = await fetchWatchConfigs(options?.userServiceId)
            setConfigs(data)
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Erreur lors du chargement")
            setError(error)
        } finally {
            setLoading(false)
        }
    }, [options?.userServiceId])

    const createConfig = useCallback(
        async (config: Omit<WatchConfig, "id" | "created_at">, serviceIds?: string[]): Promise<WatchConfig | null> => {
            try {
                setError(null)

                const newConfig = await insertWatchConfig({
                    ...config,
                    service_ids: serviceIds ?? null,
                })
                setConfigs((prev) => [newConfig, ...prev])
                return newConfig
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Erreur lors de la création")
                setError(error)
                return null
            }
        },
        []
    )

    const updateConfig = useCallback(
        async (
            id: number,
            config: Partial<Omit<WatchConfig, "id" | "created_at">>
        ): Promise<WatchConfig | null> => {
            try {
                setError(null)

                const updatedConfig = await updateWatchConfig(id, config)
                setConfigs((prev) =>
                    prev.map((c) => (c.id === id ? updatedConfig : c))
                )
                return updatedConfig
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Erreur lors de la mise à jour")
                setError(error)
                return null
            }
        },
        []
    )

    const updateConfigServices = useCallback(
        async (id: number, serviceIds: string[] | null): Promise<boolean> => {
            try {
                setError(null)

                await updateWatchConfigServices(id, serviceIds)
                setConfigs((prev) =>
                    prev.map((c) => (c.id === id ? { ...c, service_ids: serviceIds } : c))
                )
                return true
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Erreur lors de la mise à jour des services")
                setError(error)
                return false
            }
        },
        []
    )

    const deleteConfig = useCallback(
        async (id: number): Promise<boolean> => {
            try {
                setError(null)

                await deleteWatchConfig(id)
                setConfigs((prev) => prev.filter((c) => c.id !== id))
                return true
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Erreur lors de la suppression")
                setError(error)
                return false
            }
        },
        []
    )

    const getConfigsForService = useCallback(
        async (userId: string): Promise<WatchConfig[]> => {
            try {
                return await fetchWatchConfigs(userId)
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Erreur lors de la récupération des configurations")
                setError(error)
                return []
            }
        },
        []
    )

    useEffect(() => {
        fetchConfigs()
    }, [fetchConfigs])

    return {
        configs,
        loading,
        error,
        createConfig,
        updateConfig,
        updateConfigServices,
        deleteConfig,
        getConfigsForService,
        refetch: fetchConfigs
    }
}
