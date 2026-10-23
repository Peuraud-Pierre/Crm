import React, { memo } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/shared/ui/atoms/accordion"
import { Calendar, Clock } from "lucide-react"
import type { VeilleItem } from "../types/veille.types"
import { parseExecutiveSummary } from "../utils/validation"
import { getImportanceColor, getImportanceLabel } from "../utils/formatters"

interface VeilleCardProps {
    item: VeilleItem
    hideHeader?: boolean
}

const VeilleCardComponent: React.FC<VeilleCardProps> = ({ item, hideHeader = false }) => {
    // Parse executive summary with error handling
    const summary = parseExecutiveSummary(item.executive_summary)

    // If summary is not available, don't render the card
    if (!summary) {
        return null
    }

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
                                Veille {summary.periode}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4" />
                                Créée le {formatDate(item.created_at)}
                            </CardDescription>
                        </div>
                    </div>

                    {summary.secteurs_cibles &&
                        summary.secteurs_cibles.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Secteurs cibles
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {summary.secteurs_cibles.map(
                                        (secteur) => (
                                            <Badge
                                                key={secteur}
                                                variant="secondary"
                                            >
                                                {secteur}
                                            </Badge>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                </CardHeader>
            )}

            <CardContent className={`space-y-0 ${hideHeader ? "pt-4" : ""}`}>
                {/* Secteurs cibles (shown when header is hidden) */}
                {hideHeader && summary.secteurs_cibles &&
                    summary.secteurs_cibles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pb-4">
                            {summary.secteurs_cibles.map((secteur) => (
                                <Badge
                                    key={secteur}
                                    variant="secondary"
                                    className="text-xs"
                                >
                                    {secteur}
                                </Badge>
                            ))}
                        </div>
                    )}

                {/* Actualités principales */}
                {summary.actualites_principales &&
                    summary.actualites_principales.length > 0 && (
                    <div className="py-4 first:pt-0 border-b border-border/40 last:border-0">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            Actualites principales
                        </h3>
                        <div className="space-y-3">
                            {summary.actualites_principales.map(
                                (actu) => (
                                    <div
                                        key={actu.titre}
                                        className="p-3 rounded-lg border-l-2 border-primary/50 bg-muted/20 space-y-2"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <h4 className="font-semibold text-sm leading-tight">
                                                {actu.titre}
                                            </h4>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDate(
                                                    actu.date_publication
                                                )}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {actu.resume}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {actu.mots_cles.map((mot) => (
                                                <Badge
                                                    key={mot}
                                                    variant="outline"
                                                    className="text-xs"
                                                >
                                                    {mot}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}

                {/* Sections détaillées */}
                {summary.sections && summary.sections.length > 0 && (
                    <div className="py-4 border-b border-border/40 last:border-0">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            Sections detaillees
                        </h3>
                        <Accordion type="single" collapsible className="w-full">
                            {summary.sections.map((section) => (
                                <AccordionItem
                                    key={section.titre}
                                    value={`section-${section.titre}`}
                                    className="border-l-2 border-primary/30"
                                >
                                    <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/30 rounded-t-lg text-sm">
                                        <span className="font-semibold text-left">
                                            {section.titre}
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4">
                                        <div className="space-y-3 pt-2">
                                            {section.bullet_points.map(
                                                (point) => (
                                                    <div
                                                        key={point.titre}
                                                        className="p-3 rounded-lg border-l-2 border-primary/30 bg-muted/15 space-y-2"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <h5 className="font-medium text-sm leading-tight">
                                                                {point.titre}
                                                            </h5>
                                                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                {formatDate(
                                                                    point.date_publication
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                                            {point.resume}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {point.mots_cles.map(
                                                                (mot) => (
                                                                    <Badge
                                                                        key={mot}
                                                                        variant="outline"
                                                                        className="text-xs"
                                                                    >
                                                                        {mot}
                                                                    </Badge>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
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

export const VeilleCard = memo(VeilleCardComponent)
