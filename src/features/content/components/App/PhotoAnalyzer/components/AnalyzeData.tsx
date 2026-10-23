import { type AnalyzeItem } from "@/features/content/routes/ContentList"
import { motion } from "framer-motion"
import {
    BookOpen,
    Factory,
    Info,
    ListTree,
    Palette,
    StickyNote,
    Tag,
} from "lucide-react"

interface AnalyzeDataProps {
    analyzeData: AnalyzeItem | null
}

export function AnalyzeData({ analyzeData }: AnalyzeDataProps) {
    if (!analyzeData) return null

    const {
        category,
        color,
        brand,
        summary,
        brand_history,
        specs,
        auth_notes,
    } = analyzeData

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-10 w-full max-w-2xl mx-auto rounded-2xl border border-border bg-card/70 backdrop-blur-sm shadow-lg p-8 space-y-8"
        >
            {/* Titre */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center gap-2 text-center"
            >
                <BookOpen className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    Analyse du contenu
                </h3>
            </motion.div>

            {/* Résumé */}
            {summary && (
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-muted/40 border border-border/50 rounded-xl p-4 text-sm italic text-muted-foreground leading-relaxed text-center"
                >
                    {summary}
                </motion.p>
            )}

            {/* Infos principales */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
            >
                {category && (
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-primary/80" />
                        <span className="text-foreground font-medium">
                            {category}
                        </span>
                    </div>
                )}
                {brand && (
                    <div className="flex items-center gap-2">
                        <Factory className="w-4 h-4 text-primary/80" />
                        <span className="text-foreground font-medium">
                            {brand}
                        </span>
                    </div>
                )}
                {color && (
                    <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-primary/80" />
                        <span className="text-foreground font-medium">
                            {color}
                        </span>
                    </div>
                )}
            </motion.div>

            {/* Spécifications */}
            {Array.isArray(specs) && specs.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2 border-b border-border pb-1">
                        <ListTree className="w-4 h-4 text-primary/70" />
                        <h4 className="font-semibold text-foreground text-base tracking-tight">
                            Spécifications
                        </h4>
                    </div>

                    <div className="divide-y divide-border/60 rounded-lg overflow-hidden">
                        {specs.map((spec, index) => (
                            <motion.div
                                key={spec.name}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 + index * 0.05 }}
                                className="flex justify-between py-2 px-1 text-sm hover:bg-muted/30 transition-colors"
                            >
                                <span className="font-medium text-foreground/90">
                                    {spec.name}
                                </span>
                                <span className="text-muted-foreground text-right max-w-[65%]">
                                    {spec.value}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Historique marque */}
            {brand_history && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="space-y-2"
                >
                    <div className="flex items-center gap-2 border-b border-border pb-1">
                        <Info className="w-4 h-4 text-primary/70" />
                        <h4 className="font-semibold text-foreground text-base tracking-tight">
                            Historique de la marque
                        </h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                        {typeof brand_history === "string"
                            ? brand_history
                            : brand_history.overview}
                    </p>
                </motion.div>
            )}

            {/* Notes internes */}
            {auth_notes && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-2"
                >
                    <div className="flex items-center gap-2 border-b border-border pb-1">
                        <StickyNote className="w-4 h-4 text-primary/70" />
                        <h4 className="font-semibold text-foreground text-base tracking-tight">
                            Notes internes
                        </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {auth_notes}
                    </p>
                </motion.div>
            )}
        </motion.div>
    )
}
