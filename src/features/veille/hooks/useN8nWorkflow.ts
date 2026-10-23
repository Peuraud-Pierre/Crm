import { useState, useCallback } from "react"
import { env } from "@/shared/lib/env"
import { fetchLatestReport } from "../services/veilleReportService"
import type { VeilleItem } from "../types/veille.types"
import type { WatchConfig } from "./useTopics"

export const N8N_WORKFLOW_ID = "YQHSmYyfSzYcgJ5R" // "Veille Hebdo Thématique via OpenRouter"

interface WorkflowExecution {
    id: string
    status: string
    data: VeilleItem | null
    startTime: string
    endTime?: string
}

interface UseN8nWorkflowResult {
    executing: boolean
    lastExecution: WorkflowExecution | null
    error: Error | null
    execute: (config: WatchConfig) => Promise<void>
    clearError: () => void
    clearLastExecution: () => void
    fetchLatest: (configName: string) => Promise<void>
}

export const useN8nWorkflow = (): UseN8nWorkflowResult => {
    const [executing, setExecuting] = useState(false)
    const [lastExecution, setLastExecution] = useState<WorkflowExecution | null>(null)
    const [error, setError] = useState<Error | null>(null)

    const fetchLatest = useCallback(async (configName: string) => {
        try {
            setError(null)
            // Récupérer le dernier rapport pour la configuration spécifiée
            const data = await fetchLatestReport(configName)

            if (data) {
                setLastExecution({
                    id: data.id,
                    status: "completed",
                    data: data as VeilleItem,
                    startTime: data.created_at ?? new Date().toISOString(),
                })
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Erreur lors de la récupération")
            setError(error)
        }
    }, [])

    const execute = useCallback(
        async (config: WatchConfig) => {
            try {
                setExecuting(true)
                setError(null)

                if (!config || !config.name) {
                    throw new Error("Veuillez sélectionner une configuration")
                }

                // Déclencher le workflow n8n via webhook avec toute la configuration
                const webhookUrl =
                    env.PUBLIC_N8N_WEBHOOK_URL ||
                    "https://n8n.nokk-project.example/webhook/veille-rh"

                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        trigger: "manual",
                        config: {
                            name: config.name,
                            topic: config.topic,
                            language: config.language,
                            horizon: config.horizon,
                            persona: config.persona,
                            service_ids: config.service_ids ?? null,
                        },
                    }),
                })

                if (!response.ok) {
                    throw new Error(`Webhook failed: ${response.statusText}`)
                }

                // Attendre un peu que le workflow s'exécute et stocke les résultats
                await new Promise((resolve) => setTimeout(resolve, 3000))
                await fetchLatest(config.topic)
            } catch (err) {
                const error = err instanceof Error ? err : new Error("Erreur lors de l'exécution")
                setError(error)
            } finally {
                setExecuting(false)
            }
        },
        [fetchLatest]
    )

    const clearError = useCallback(() => {
        setError(null)
    }, [])

    const clearLastExecution = useCallback(() => {
        setLastExecution(null)
    }, [])

    return { executing, lastExecution, error, execute, clearError, clearLastExecution, fetchLatest }
}
