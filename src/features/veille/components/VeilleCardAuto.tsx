import React, { memo, useState } from "react"
import type { VeilleItem } from "../types/veille.types"
import { VeilleCard } from "./VeilleCard"
import { VeilleCardSimple } from "./VeilleCardSimple"
import { parseExecutiveSummary } from "../utils/validation"
import { getImportanceColor, getImportanceLabel } from "../utils/formatters"
import { Badge } from "@/shared/ui/atoms/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/atoms/collapsible"
import { Calendar, ChevronDown } from "lucide-react"

interface VeilleCardAutoProps {
    item: VeilleItem
    defaultOpen?: boolean
}

const VeilleCardAutoComponent: React.FC<VeilleCardAutoProps> = ({ item, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen)
    const structuredSummary = parseExecutiveSummary(item.executive_summary)

    const hasContent =
        structuredSummary ||
        item.executive_summary ||
        item.risks ||
        item.opportunities ||
        item.recommended_actions ||
        item.raw_research

    if (!hasContent) return null


    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
    }

    const summaryPreview = item.executive_summary
        ? item.executive_summary.slice(0, 120).replace(/\n/g, " ") + (item.executive_summary.length > 120 ? "..." : "")
        : ""

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <button className="w-full text-left rounded-lg border border-border/60 bg-card shadow-sm p-3 sm:p-4 hover:shadow-md hover:border-border transition cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <Badge className={`${getImportanceColor(item.importance_score)} text-white text-[10px] px-1.5 py-0`}>
                                    {getImportanceLabel(item.importance_score)}
                                </Badge>
                                {item.frequency && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize border-border/80">
                                        {item.frequency}
                                    </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(item.created_at)}
                                </span>
                            </div>
                            <p className="font-semibold text-sm truncate text-foreground">{item.title || item.topic}</p>
                            {!isOpen && summaryPreview && (
                                <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">{summaryPreview}</p>
                            )}
                        </div>
                        {item.tags && item.tags.length > 0 && !isOpen && (
                            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                                {item.tags.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary/60">
                                        {tag}
                                    </Badge>
                                ))}
                                {item.tags.length > 2 && (
                                    <span className="text-[10px] text-muted-foreground/70">+{item.tags.length - 2}</span>
                                )}
                            </div>
                        )}
                        <ChevronDown className={`h-4 w-4 text-muted-foreground/60 shrink-0 transition-transform duration-base ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-1">
                    {structuredSummary ? (
                        <VeilleCard item={item} hideHeader />
                    ) : (
                        <VeilleCardSimple item={item} hideHeader />
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

export const VeilleCardAuto = memo(VeilleCardAutoComponent)
