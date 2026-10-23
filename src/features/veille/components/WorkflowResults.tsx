import React, { useEffect, useState } from "react"
import { Badge } from "@/shared/ui/atoms/badge"
import { CheckCircle, X } from "lucide-react"
import type { VeilleItem } from "../types/veille.types"

interface WorkflowResultsProps {
    data?: VeilleItem | null
    status?: string
    timestamp?: string
    onDismiss?: () => void
}

export const WorkflowResults: React.FC<WorkflowResultsProps> = ({
    data,
    timestamp,
    onDismiss,
}) => {
    const [visible, setVisible] = useState(true)

    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- entity resync: re-show the results banner whenever new data arrives
        setVisible(true)
        const timer = setTimeout(() => {
            setVisible(false)
            onDismiss?.()
        }, 15000)
        return () => clearTimeout(timer)
    }, [data, onDismiss])

    if (!data || !visible) {
        return null
    }

    const handleDismiss = () => {
        setVisible(false)
        onDismiss?.()
    }

    return (
        <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
            <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            Veille declenchee : {data.topic}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                            {data.importance_score !== null && (
                                <Badge variant="outline" className="text-xs">
                                    Score: {data.importance_score}/10
                                </Badge>
                            )}
                            <button
                                onClick={handleDismiss}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    {timestamp && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(timestamp).toLocaleString("fr-FR")}
                        </p>
                    )}
                    {data.executive_summary && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {data.executive_summary.slice(0, 200).replace(/\n/g, " ")}
                            {data.executive_summary.length > 200 ? "..." : ""}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
