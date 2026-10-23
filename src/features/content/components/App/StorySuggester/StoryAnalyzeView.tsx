import type { AnalyzeItem } from "@/features/content/routes/ContentList"
import { motion } from "framer-motion"
import { BookImage, Hash, Megaphone, Sparkles, Wand2 } from "lucide-react"

interface Props {
    analyzeData: AnalyzeItem
}

const FILTRE_LABELS: Record<string, string> = {
    standard: "Standard",
    sepia: "Sépia",
    noir_blanc: "Noir & Blanc",
    rose: "Rose",
}

const EFFET_LABELS: Record<string, string> = {
    standard: "Standard",
    myst: "Mystérieux",
    polaroid: "Polaroid",
    dreamy: "Dreamy",
    argentic: "Argentic",
    stardust: "Stardust",
}

export function StoryAnalyzeView({ analyzeData }: Props) {
    const { summary, category, color, brand_history, storyData } = analyzeData

    const hashtags =
        storyData?.hashtags ??
        (typeof brand_history === "string" && brand_history
            ? brand_history.split(/\s+/).filter(Boolean)
            : [])

    const secondary_caption = storyData?.secondary_caption ?? ""
    const cta = storyData?.cta ?? ""
    const emojis = storyData?.emojis_suggested ?? []
    const concepts = storyData?.story_concepts ?? []
    const platform = storyData?.platform ?? ""
    const story_style = storyData?.story_style ?? ""
    const filtre = storyData?.visual_style?.filtre ?? category ?? ""
    const effet = storyData?.visual_style?.effet ?? color ?? ""

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-10 w-full max-w-2xl mx-auto rounded-2xl border border-border bg-card/70 backdrop-blur-sm shadow-lg p-8 space-y-8"
        >
            {/* En-tête */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center gap-3 text-center"
            >
                <BookImage className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    Suggestions Story
                </h3>
                <div className="flex flex-wrap justify-center gap-2">
                    {platform && (
                        <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium capitalize">
                            {platform}
                        </span>
                    )}
                    {story_style && (
                        <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">
                            {story_style}
                        </span>
                    )}
                    {filtre && filtre !== "standard" && (
                        <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                            Filtre : {FILTRE_LABELS[filtre] ?? filtre}
                        </span>
                    )}
                    {effet && effet !== "standard" && (
                        <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            Effet : {EFFET_LABELS[effet] ?? effet}
                        </span>
                    )}
                </div>
            </motion.div>

            {/* Caption principale */}
            {summary && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-1"
                >
                    <p className="text-lg font-bold text-foreground leading-snug text-center">
                        {summary}
                    </p>
                    {secondary_caption && (
                        <p className="text-sm text-muted-foreground text-center">
                            {secondary_caption}
                        </p>
                    )}
                    {emojis.length > 0 && (
                        <p className="text-xl text-center">{emojis.join(" ")}</p>
                    )}
                </motion.div>
            )}

            {/* CTA */}
            {cta && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 bg-foreground text-background rounded-xl px-4 py-3"
                >
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">{cta}</span>
                </motion.div>
            )}

            {/* 3 Concepts Story */}
            {concepts.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2 border-b border-border pb-1">
                        <Wand2 className="w-4 h-4 text-primary/70" />
                        <h4 className="font-semibold text-foreground text-base tracking-tight">
                            3 Concepts Story
                        </h4>
                    </div>
                    <div className="space-y-3">
                        {concepts.map((concept, i) => (
                            <motion.div
                                key={concept.title}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.08 }}
                                className="flex gap-3 p-4 border border-border rounded-xl bg-card"
                            >
                                <div className="shrink-0 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <p className="font-semibold text-foreground text-sm">
                                        {concept.title}
                                    </p>
                                    <p className="text-sm italic text-muted-foreground border-l-2 border-primary/50 pl-2">
                                        &ldquo;{concept.caption}&rdquo;
                                    </p>
                                    {concept.description && (
                                        <p className="text-xs text-muted-foreground/80 leading-relaxed">
                                            {concept.description}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Hashtags */}
            {hashtags.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                    className="space-y-3"
                >
                    <div className="flex items-center gap-2 border-b border-border pb-1">
                        <Hash className="w-4 h-4 text-primary/70" />
                        <h4 className="font-semibold text-foreground text-base tracking-tight">
                            Hashtags Suggérés
                        </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {hashtags.map((tag) => (
                            <span
                                key={tag}
                                className="text-xs px-3 py-1 rounded-full bg-muted border border-border text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Style visuel si pas affiché en badge (fallback) */}
            {(filtre || effet) && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-2"
                >
                    <Sparkles className="w-4 h-4 text-primary/70" />
                    <span className="text-xs text-muted-foreground">
                        Style visuel :{" "}
                        <span className="font-medium text-foreground">
                            {FILTRE_LABELS[filtre] ?? filtre}
                        </span>
                        {effet && effet !== filtre && (
                            <>
                                {" "}
                                +{" "}
                                <span className="font-medium text-foreground">
                                    {EFFET_LABELS[effet] ?? effet}
                                </span>
                            </>
                        )}
                    </span>
                </motion.div>
            )}
        </motion.div>
    )
}
