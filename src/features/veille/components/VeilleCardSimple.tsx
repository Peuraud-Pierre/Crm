import React, { memo } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import { Calendar, ExternalLink } from "lucide-react"
import type { VeilleItem } from "../types/veille.types"
import { formatUrlForDisplay, getImportanceColor, getImportanceLabel } from "../utils/formatters"
import { formatText } from "../utils/textParsing"

interface VeilleCardSimpleProps {
    item: VeilleItem
    hideHeader?: boolean
}

/**
 * Version simplifiée du composant VeilleCard pour afficher les rapports
 * avec un executive_summary au format texte simple
 */
const VeilleCardSimpleComponent: React.FC<VeilleCardSimpleProps> = ({
    item,
    hideHeader = false,
}) => {
    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        })
    }


    return (
        <Card variant="interactive" className="w-full">
            {!hideHeader && (
                <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                    className={`${getImportanceColor(item.importance_score)} text-white`}
                                >
                                    {getImportanceLabel(item.importance_score)}
                                </Badge>
                                {item.frequency && (
                                    <Badge variant="outline" className="capitalize">
                                        {item.frequency}
                                    </Badge>
                                )}
                            </div>
                            <CardTitle className="text-xl leading-tight">
                                {item.topic}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4" />
                                Créée le {formatDate(item.created_at)}
                            </CardDescription>
                        </div>
                    </div>

                    {item.tags && item.tags.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                                Tags
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {item.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardHeader>
            )}

            <CardContent className={`space-y-0 ${hideHeader ? "pt-4" : ""}`}>
                {/* Tags (shown when header is hidden) */}
                {hideHeader && item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pb-4">
                        {item.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Resume executif */}
                {item.executive_summary && (
                    <div className="py-4 first:pt-0 border-b border-border/40 last:border-0">
                        <h3 className="text-sm font-semibold mb-2">
                            Resume executif
                        </h3>
                        <div className="p-3 rounded-lg bg-muted/20">
                            {formatText(item.executive_summary, "blue")}
                        </div>
                    </div>
                )}

                {/* Risques */}
                {item.risks && (
                    <div className="py-4 border-b border-border/40 last:border-0">
                        <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            Risques identifies
                        </h3>
                        <div className="p-3 rounded-lg border-l-2 border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/10">
                            {formatText(item.risks, "red")}
                        </div>
                    </div>
                )}

                {/* Opportunites */}
                {item.opportunities && (
                    <div className="py-4 border-b border-border/40 last:border-0">
                        <h3 className="text-sm font-semibold text-emerald-700 dark:text-green-400 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            Opportunites
                        </h3>
                        <div className="p-3 rounded-lg border-l-2 border-emerald-300 bg-emerald-50/30 dark:border-green-800 dark:bg-green-950/10">
                            {formatText(item.opportunities, "green")}
                        </div>
                    </div>
                )}

                {/* Actions recommandees */}
                {item.recommended_actions && (
                    <div className="py-4 border-b border-border/40 last:border-0">
                        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            Actions recommandees
                        </h3>
                        <div className="p-3 rounded-lg border-l-2 border-blue-300 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/10">
                            {formatText(item.recommended_actions, "blue")}
                        </div>
                    </div>
                )}

                {/* Sources / Citations */}
                {item.metadata &&
                    typeof item.metadata === "object" &&
                    "citations" in item.metadata &&
                    Array.isArray(item.metadata.citations) &&
                    item.metadata.citations.length > 0 && (
                        <div className="py-4 border-b border-border/40 last:border-0">
                            <h3 className="text-sm font-semibold mb-2">Sources</h3>
                            <div className="p-3 rounded-lg bg-muted/15">
                                <ul className="space-y-1.5">
                                    {item.metadata.citations.map(
                                        (citation, index) => (
                                            <li
                                                key={citation}
                                                className="text-sm"
                                            >
                                                <a
                                                    href={citation}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:underline flex items-start gap-2 group"
                                                >
                                                    <span className="text-muted-foreground shrink-0">
                                                        [{index + 1}]
                                                    </span>
                                                    <span
                                                        className="break-all flex-1 min-w-0"
                                                        title={citation}
                                                    >
                                                        {formatUrlForDisplay(
                                                            citation
                                                        )}
                                                    </span>
                                                    <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </a>
                                            </li>
                                        )
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}

                {/* Recherche brute (collapsible) */}
                {item.raw_research && (
                    <details className="py-4 border-b border-border/40 last:border-0">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                            Voir la recherche complete
                        </summary>
                        <div className="p-3 rounded-lg bg-muted/15 mt-2">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                                {item.raw_research}
                            </p>
                        </div>
                    </details>
                )}

                {/* Informations techniques */}
                {(item.source_model || item.analysis_model) && (
                    <div className="pt-4 space-y-1.5">
                        {item.source_model && (
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Source:</span>{" "}
                                {item.source_model}
                            </p>
                        )}
                        {item.analysis_model && (
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Analyse:</span>{" "}
                                {item.analysis_model}
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export const VeilleCardSimple = memo(VeilleCardSimpleComponent)
