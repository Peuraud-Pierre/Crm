import React, { useState } from "react"
import { useN8nWorkflow, N8N_WORKFLOW_ID } from "../hooks/useN8nWorkflow"
import { TopicSelector } from "./TopicSelector"
import { WorkflowResults } from "./WorkflowResults"
import type { WatchConfig } from "../hooks/useTopics"
import { Button } from "@/shared/ui/atoms/button"
import { Badge } from "@/shared/ui/atoms/badge"
import { AlertCircle, Play, RefreshCw } from "lucide-react"

interface WorkflowExecutorProps {
    onExecutionComplete?: () => void
}

export const WorkflowExecutor: React.FC<WorkflowExecutorProps> = ({ onExecutionComplete }) => {
    const { executing, lastExecution, error, execute, clearError, fetchLatest } =
        useN8nWorkflow()
    const [selectedConfig, setSelectedConfig] = useState<WatchConfig | undefined>()

    const handleExecute = async () => {
        if (selectedConfig) {
            await execute(selectedConfig)
            onExecutionComplete?.()
        }
    }

    const handleRefresh = async () => {
        if (selectedConfig) {
            await fetchLatest(selectedConfig.topic)
        }
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-4">
                <div>
                    <h3 className="font-semibold">Veille RH Hebdo via OpenRouter</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Exécuter le workflow de veille sur la configuration de votre choix
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                            {N8N_WORKFLOW_ID}
                        </Badge>
                        <Badge variant="secondary">Active</Badge>
                    </div>
                </div>

                {/* Config Selector */}
                <TopicSelector selectedConfig={selectedConfig} onConfigSelect={setSelectedConfig} />

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <Button
                        onClick={handleRefresh}
                        variant="outline"
                        size="sm"
                        disabled={executing || !selectedConfig}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Rafraîchir
                    </Button>
                    <Button
                        onClick={handleExecute}
                        disabled={!selectedConfig}
                        loading={executing}
                        className="gap-2"
                    >
                        {executing ? (
                            "Exécution…"
                        ) : (
                            <>
                                <Play className="h-4 w-4" />
                                Exécuter
                            </>
                        )}
                    </Button>
                </div>

                {error && (
                    <div className="p-3 rounded-lg border border-destructive bg-destructive/10">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-destructive">Erreur</p>
                                <p className="text-xs text-destructive/80 mt-1">{error.message}</p>
                            </div>
                            <button
                                onClick={clearError}
                                className="text-destructive/80 hover:text-destructive text-xs font-medium"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}

                {lastExecution && !error && (
                    <WorkflowResults
                        data={lastExecution.data}
                        status={lastExecution.status}
                        timestamp={lastExecution.startTime}
                    />
                )}
            </div>
        </div>
    )
}
